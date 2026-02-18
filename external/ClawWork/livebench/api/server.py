"""
LiveBench API Server - Real-time updates and data access for frontend

This FastAPI server provides:
- WebSocket endpoint for live agent activity streaming
- REST endpoints for agent data, tasks, and economic metrics
- Real-time updates as agents work and learn
"""

import os
import json
import asyncio
import random
import secrets
import time
import hashlib
import re
from datetime import datetime
from pathlib import Path
from collections import deque
from typing import Deque, Dict, List, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query, Depends, Header, Request
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import glob
import subprocess
import tempfile
import uuid
import sys

app = FastAPI(title="LiveBench API", version="1.0.0")


def _parse_csv_env(name: str, default: str) -> List[str]:
    raw = os.getenv(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


_DEFAULT_CORS_ORIGINS = "http://localhost:3000,http://127.0.0.1:3000"
ALLOWED_CORS_ORIGINS = _parse_csv_env("CLAWWORK_CORS_ORIGINS", _DEFAULT_CORS_ORIGINS)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-ClawWork-Token"],
)

CLAWWORK_ENV = os.getenv("CLAWWORK_ENV", "development").strip().lower()
_default_require_auth = "true" if CLAWWORK_ENV == "production" else "false"
REQUIRE_MUTATION_AUTH = os.getenv("CLAWWORK_REQUIRE_AUTH", _default_require_auth).strip().lower() == "true"
REQUIRE_READ_AUTH = os.getenv("CLAWWORK_REQUIRE_READ_AUTH", _default_require_auth).strip().lower() == "true"
_default_require_tenant = "true" if CLAWWORK_ENV == "production" else "false"
REQUIRE_TENANT_CONTEXT = os.getenv("CLAWWORK_REQUIRE_TENANT_CONTEXT", _default_require_tenant).strip().lower() == "true"
CLAWWORK_API_TOKEN = os.getenv("CLAWWORK_API_TOKEN", "").strip()
_default_rate_limit_enabled = "true" if CLAWWORK_ENV == "production" else "false"
RATE_LIMIT_ENABLED = os.getenv("CLAWWORK_RATE_LIMIT_ENABLED", _default_rate_limit_enabled).strip().lower() == "true"
RATE_LIMIT_WINDOW_SEC = int(os.getenv("CLAWWORK_RATE_LIMIT_WINDOW_SEC", "60"))
READ_RATE_LIMIT = int(os.getenv("CLAWWORK_READ_RATE_LIMIT", "240"))
WRITE_RATE_LIMIT = int(os.getenv("CLAWWORK_WRITE_RATE_LIMIT", "60"))
MAX_TERMINAL_LOG_BYTES = int(os.getenv("CLAWWORK_MAX_TERMINAL_LOG_BYTES", "262144"))
ALLOWED_ENV_VAR_KEYS = set(
    _parse_csv_env(
        "CLAWWORK_ALLOWED_ENV_KEYS",
        "OPENAI_API_KEY,E2B_API_KEY,WEB_SEARCH_API_KEY,ANTHROPIC_API_KEY",
    )
)

if (REQUIRE_MUTATION_AUTH or REQUIRE_READ_AUTH) and not CLAWWORK_API_TOKEN:
    raise RuntimeError("API auth is enabled but CLAWWORK_API_TOKEN is not configured")

_rate_limit_buckets: Dict[str, Deque[float]] = {}
TENANT_HEADER = "x-tenant-id"
TENANT_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_.:@-]{1,128}$")


def _get_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _ip_hash(ip: str) -> str:
    return hashlib.sha256(ip.encode("utf-8")).hexdigest()[:16]


def _audit_log(request: Request, action: str, status: str, details: Optional[dict] = None) -> None:
    payload = {
        "type": "audit",
        "source": "clawwork-api",
        "ts": datetime.utcnow().isoformat() + "Z",
        "action": action,
        "status": status,
        "method": request.method,
        "path": request.url.path,
        "ip_hash": _ip_hash(_get_client_ip(request)),
        "details": details or {},
    }
    print(json.dumps(payload, separators=(",", ":")))


def _enforce_rate_limit(request: Request, action: str, is_write: bool) -> None:
    if not RATE_LIMIT_ENABLED:
        return

    limit = WRITE_RATE_LIMIT if is_write else READ_RATE_LIMIT
    window_sec = max(1, RATE_LIMIT_WINDOW_SEC)
    now = time.time()
    bucket_key = f"{action}:{_get_client_ip(request)}"
    bucket = _rate_limit_buckets.setdefault(bucket_key, deque())

    while bucket and (now - bucket[0]) > window_sec:
        bucket.popleft()

    if len(bucket) >= limit:
        _audit_log(
            request,
            action=action,
            status="rate_limited",
            details={"limit": limit, "window_sec": window_sec},
        )
        raise HTTPException(status_code=429, detail="Too many requests. Please retry later.")

    bucket.append(now)

BASE_DATA_ROOT = (Path(__file__).parent.parent / "data").resolve()
TENANTS_ROOT = BASE_DATA_ROOT / "tenants"


def _extract_auth_token(
    authorization: Optional[str] = None,
    x_clawwork_token: Optional[str] = None,
) -> str:
    if authorization and authorization.lower().startswith("bearer "):
        return authorization.split(" ", 1)[1].strip()
    if x_clawwork_token:
        return x_clawwork_token.strip()
    return ""


def _validate_api_token(token: str) -> bool:
    return bool(token) and secrets.compare_digest(token, CLAWWORK_API_TOKEN)


def _resolve_tenant_id(request: Request) -> str:
    tenant_id = (request.headers.get(TENANT_HEADER) or "").strip()
    if not tenant_id:
        if REQUIRE_TENANT_CONTEXT:
            raise HTTPException(status_code=400, detail="Missing tenant context")
        return "default"
    if not TENANT_ID_PATTERN.fullmatch(tenant_id):
        raise HTTPException(status_code=400, detail="Invalid tenant context")
    return tenant_id


def _tenant_key(tenant_id: str) -> str:
    return hashlib.sha256(tenant_id.encode("utf-8")).hexdigest()[:32]


def _get_tenant_paths(request: Request) -> Dict[str, object]:
    tenant_id = _resolve_tenant_id(request)
    key = _tenant_key(tenant_id)
    tenant_root = TENANTS_ROOT / key
    return {
        "tenant_id": tenant_id,
        "tenant_key": key,
        "tenant_root": tenant_root,
        "data_path": tenant_root / "agent_data",
        "simulations_path": tenant_root / "simulations.json",
        "hidden_agents_path": tenant_root / "hidden_agents.json",
        "displaying_names_path": tenant_root / "displaying_names.json",
    }

# Task value lookup (task_id -> task_value_usd)
_TASK_VALUES_PATH = Path(__file__).parent.parent.parent / "scripts" / "task_value_estimates" / "task_values.jsonl"


def _load_task_values() -> dict:
    values = {}
    if not _TASK_VALUES_PATH.exists():
        return values
    with open(_TASK_VALUES_PATH, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
                tid = entry.get("task_id")
                val = entry.get("task_value_usd")
                if tid and val is not None:
                    values[tid] = val
            except json.JSONDecodeError:
                pass
    return values


TASK_VALUES = _load_task_values()

# Active WebSocket connections
active_connections: List[WebSocket] = []


class AgentStatus(BaseModel):
    """Agent status model"""
    signature: str
    balance: float
    net_worth: float
    survival_status: str
    current_activity: Optional[str] = None
    current_date: Optional[str] = None


class WorkTask(BaseModel):
    """Work task model"""
    task_id: str
    sector: str
    occupation: str
    prompt: str
    date: str
    status: str = "assigned"


class LearningEntry(BaseModel):
    """Learning memory entry"""
    topic: str
    content: str
    timestamp: str


class EconomicMetrics(BaseModel):
    """Economic metrics model"""
    balance: float
    total_token_cost: float
    total_work_income: float
    net_worth: float
    dates: List[str]
    balance_history: List[float]


# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[WebSocket, str] = {}

    async def connect(self, websocket: WebSocket, tenant_key: str):
        await websocket.accept()
        self.active_connections[websocket] = tenant_key

    def disconnect(self, websocket: WebSocket):
        self.active_connections.pop(websocket, None)

    async def broadcast(self, message: dict, tenant_key: Optional[str] = None):
        """Broadcast message to all connected clients"""
        for connection, connection_tenant in list(self.active_connections.items()):
            if tenant_key and connection_tenant != tenant_key:
                continue
            try:
                await connection.send_json(message)
            except:
                pass


manager = ConnectionManager()


@app.get("/")
async def root():
    """API root endpoint"""
    return {
        "message": "LiveBench API",
        "version": "1.0.0",

        "endpoints": {
            "agents": "/api/agents",
            "agent_detail": "/api/agents/{signature}",
            "tasks": "/api/agents/{signature}/tasks",
            "learning": "/api/agents/{signature}/learning",
            "economic": "/api/agents/{signature}/economic",
            "websocket": "/ws",
            "simulations": "/api/simulations",
            "stop_simulation": "/api/simulations/{sim_id}/stop"
        }
    }


class SimulationConfig(BaseModel):
    config: dict
    env_vars: Optional[Dict[str, str]] = None


def require_write_auth(
    request: Request,
    authorization: Optional[str] = Header(default=None),
    x_clawwork_token: Optional[str] = Header(default=None),
):
    _enforce_rate_limit(request, action="api.write", is_write=True)
    _get_tenant_paths(request)

    if not REQUIRE_MUTATION_AUTH:
        return

    token = _extract_auth_token(authorization=authorization, x_clawwork_token=x_clawwork_token)
    if not _validate_api_token(token):
        _audit_log(request, action="api.write.auth", status="denied")
        raise HTTPException(status_code=401, detail="Unauthorized")


def require_read_auth(
    request: Request,
    authorization: Optional[str] = Header(default=None),
    x_clawwork_token: Optional[str] = Header(default=None),
):
    _enforce_rate_limit(request, action="api.read", is_write=False)
    _get_tenant_paths(request)

    if not REQUIRE_READ_AUTH:
        return

    token = _extract_auth_token(authorization=authorization, x_clawwork_token=x_clawwork_token)
    if not _validate_api_token(token):
        _audit_log(request, action="api.read.auth", status="denied")
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.post("/api/simulations")
async def start_simulation(
    request: Request,
    sim_config: SimulationConfig,
    _: None = Depends(require_write_auth),
):
    """Start a new agent simulation"""
    try:
        tenant_paths = _get_tenant_paths(request)
        tenant_data_path = tenant_paths["data_path"]
        simulations_path = tenant_paths["simulations_path"]
        tenant_key = tenant_paths["tenant_key"]

        # Generate unique simulation ID
        sim_id = str(uuid.uuid4())

        livebench_config = sim_config.config.setdefault("livebench", {})
        livebench_config["data_path"] = str(tenant_data_path)
        
        # Create config file
        config_dir = Path(__file__).parent.parent / "configs" / "generated"
        config_dir.mkdir(parents=True, exist_ok=True)
        config_path = config_dir / f"{sim_id}.json"
        
        with open(config_path, "w") as f:
            json.dump(sim_config.config, f, indent=2)
            
        # Determine python executable
        python_exec = sys.executable
        
        # Path to main.py
        main_script = Path(__file__).parent.parent / "main.py"
        
        # Environment variables
        env = os.environ.copy()
        if sim_config.env_vars:
            unknown_keys = [k for k in sim_config.env_vars if k not in ALLOWED_ENV_VAR_KEYS]
            if unknown_keys:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported env var keys: {', '.join(sorted(unknown_keys))}",
                )
            filtered_vars = {k: v for k, v in sim_config.env_vars.items() if v and k in ALLOWED_ENV_VAR_KEYS}
            env.update(filtered_vars)
        
        # Spawn subprocess
        # We run it detached so it doesn't block the API
        process = subprocess.Popen(
            [python_exec, str(main_script), str(config_path)],
            env=env,
            cwd=str(Path(__file__).parent.parent.parent), # Valid CWD for imports
            stdout=subprocess.DEVNULL, # Optionally redirect to log file
            stderr=subprocess.DEVNULL
        )

        # Get agent signature if available
        signature = "unknown"
        if "agents" in sim_config.config.get("livebench", {}) and len(sim_config.config["livebench"]["agents"]) > 0:
            signature = sim_config.config["livebench"]["agents"][0].get("signature", "unknown")
        
        # Save simulation record
        simulations_path.parent.mkdir(parents=True, exist_ok=True)
        simulations = []
        if simulations_path.exists():
            try:
                with open(simulations_path, 'r') as f:
                    simulations = json.load(f)
            except json.JSONDecodeError:
                pass
        
        new_sim = {
            "id": sim_id,
            "pid": process.pid,
            "status": "running",
            "signature": signature,
            "tenant_key": tenant_key,
            "config_path": str(config_path),
            "start_time": datetime.now().isoformat(),
        }
        simulations.append(new_sim)
        
        with open(simulations_path, 'w') as f:
            json.dump(simulations, f, indent=2)
        
        response = {
            "status": "success",
            "message": "Simulation started",
            "simulation_id": sim_id,
            "pid": process.pid,
            "config_path": str(config_path)
        }
        _audit_log(
            request,
            action="simulation.start",
            status="allowed",
            details={"simulation_id": sim_id, "signature": signature, "tenant_key": tenant_key},
        )
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        _audit_log(request, action="simulation.start", status="error", details={"error": str(e)})
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/simulations")
async def get_simulations(request: Request, _: None = Depends(require_read_auth)):
    """List all simulations"""
    simulations_path = _get_tenant_paths(request)["simulations_path"]
    if not simulations_path.exists():
        return {"simulations": []}
    
    try:
        with open(simulations_path, 'r') as f:
            simulations = json.load(f)
            
        # Check current status of pids
        updated = False
        for sim in simulations:
            if sim["status"] == "running":
                try:
                    # Check if process exists (sent signal 0 does no harm)
                    os.kill(sim["pid"], 0)
                except OSError:
                    sim["status"] = "terminated"
                    sim["end_time"] = datetime.now().isoformat()
                    updated = True
        
        if updated:
             with open(simulations_path, 'w') as f:
                json.dump(simulations, f, indent=2)
                
        return {"simulations": simulations}
    except Exception as e:
        return {"simulations": [], "error": str(e)}


@app.post("/api/simulations/{sim_id}/stop")
async def stop_simulation(sim_id: str, request: Request, _: None = Depends(require_write_auth)):
    """Stop a running simulation"""
    import signal
    simulations_path = _get_tenant_paths(request)["simulations_path"]
    
    if not simulations_path.exists():
        raise HTTPException(status_code=404, detail="No simulations found")
        
    try:
        with open(simulations_path, 'r') as f:
            simulations = json.load(f)
            
        found = False
        for sim in simulations:
            if sim["id"] == sim_id:
                found = True
                if sim["status"] == "running":
                    try:
                        os.kill(sim["pid"], signal.SIGTERM)
                        sim["status"] = "stopped"
                        sim["end_time"] = datetime.now().isoformat()
                    except OSError:
                        sim["status"] = "terminated"
                        sim["end_time"] = datetime.now().isoformat()  # Process already gone
                break
        
        if not found:
            raise HTTPException(status_code=404, detail="Simulation not found")
            
        with open(simulations_path, 'w') as f:
            json.dump(simulations, f, indent=2)
            
        response = {"status": "success", "message": "Simulation stopped"}
        _audit_log(request, action="simulation.stop", status="allowed", details={"simulation_id": sim_id})
        return response
        
    except HTTPException:
        raise
    except Exception as e:
         _audit_log(
             request,
             action="simulation.stop",
             status="error",
             details={"simulation_id": sim_id, "error": str(e)},
         )
         raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/agents")
async def get_agents(request: Request, _: None = Depends(require_read_auth)):
    """Get list of all agents with their current status"""
    agents = []
    tenant_paths = _get_tenant_paths(request)
    data_path = tenant_paths["data_path"]
    simulations_path = tenant_paths["simulations_path"]

    if not data_path.exists():
        return {"agents": []}

    for agent_dir in data_path.iterdir():
        if agent_dir.is_dir():
            signature = agent_dir.name

            # Get latest balance
            balance_file = agent_dir / "economic" / "balance.jsonl"
            balance_data = None
            if balance_file.exists():
                with open(balance_file, 'r') as f:
                    lines = f.readlines()
                    if lines:
                        balance_data = json.loads(lines[-1])

            # Get latest decision
            decision_file = agent_dir / "decisions" / "decisions.jsonl"
            current_activity = None
            current_date = None
            if decision_file.exists():
                with open(decision_file, 'r') as f:
                    lines = f.readlines()
                    if lines:
                        decision = json.loads(lines[-1])
                        current_activity = decision.get("activity")
                        current_date = decision.get("date")


            # Check if running
            is_running = False
            sim_id = None
            if simulations_path.exists():
                try:
                    with open(simulations_path, 'r') as f:
                        simulations = json.load(f)
                    for sim in simulations:
                        if sim.get("signature") == signature and sim.get("status") == "running":
                            # Verify PID
                            try:
                                os.kill(sim["pid"], 0)
                                is_running = True
                                sim_id = sim["id"]
                                break
                            except OSError:
                                pass # Stale entry
                except:
                    pass

            if balance_data:
                agents.append({
                    "signature": signature,
                    "balance": balance_data.get("balance", 0),
                    "net_worth": balance_data.get("net_worth", 0),
                    "survival_status": balance_data.get("survival_status", "unknown"),
                    "current_activity": current_activity,
                    "current_date": current_date,
                    "total_token_cost": balance_data.get("total_token_cost", 0),
                    "is_running": is_running,
                    "simulation_id": sim_id
                })

    return {"agents": agents}


@app.get("/api/agents/{signature}")
async def get_agent_details(signature: str, request: Request, _: None = Depends(require_read_auth)):
    """Get detailed information about a specific agent"""
    data_path = _get_tenant_paths(request)["data_path"]
    agent_dir = data_path / signature

    if not agent_dir.exists():
        raise HTTPException(status_code=404, detail="Agent not found")

    # Get balance history
    balance_file = agent_dir / "economic" / "balance.jsonl"
    balance_history = []
    if balance_file.exists():
        with open(balance_file, 'r') as f:
            for line in f:
                balance_history.append(json.loads(line))

    # Get decisions
    decision_file = agent_dir / "decisions" / "decisions.jsonl"
    decisions = []
    if decision_file.exists():
        with open(decision_file, 'r') as f:
            for line in f:
                decisions.append(json.loads(line))

    # Get evaluation statistics
    evaluations_file = agent_dir / "work" / "evaluations.jsonl"
    avg_evaluation_score = None
    evaluation_scores = []
    
    if evaluations_file.exists():
        with open(evaluations_file, 'r') as f:
            for line in f:
                eval_data = json.loads(line)
                score = eval_data.get("evaluation_score")
                if score is not None:
                    evaluation_scores.append(score)
        
        if evaluation_scores:
            avg_evaluation_score = sum(evaluation_scores) / len(evaluation_scores)
    
    # Get latest status
    latest_balance = balance_history[-1] if balance_history else {}
    latest_decision = decisions[-1] if decisions else {}

    return {
        "signature": signature,
        "current_status": {
            "balance": latest_balance.get("balance", 0),
            "net_worth": latest_balance.get("net_worth", 0),
            "survival_status": latest_balance.get("survival_status", "unknown"),
            "total_token_cost": latest_balance.get("total_token_cost", 0),
            "total_work_income": latest_balance.get("total_work_income", 0),
            "current_activity": latest_decision.get("activity"),
            "current_date": latest_decision.get("date"),
            "avg_evaluation_score": avg_evaluation_score,  # Average 0.0-1.0 score
            "num_evaluations": len(evaluation_scores)
        },
        "balance_history": balance_history,
        "decisions": decisions,
        "evaluation_scores": evaluation_scores  # List of all scores
    }


@app.get("/api/agents/{signature}/tasks")
async def get_agent_tasks(signature: str, request: Request, _: None = Depends(require_read_auth)):
    """Get all tasks assigned to an agent"""
    data_path = _get_tenant_paths(request)["data_path"]
    agent_dir = data_path / signature

    if not agent_dir.exists():
        raise HTTPException(status_code=404, detail="Agent not found")

    tasks_file = agent_dir / "work" / "tasks.jsonl"
    evaluations_file = agent_dir / "work" / "evaluations.jsonl"

    tasks = []
    if tasks_file.exists():
        with open(tasks_file, 'r') as f:
            for line in f:
                tasks.append(json.loads(line))

    # Load evaluations indexed by task_id
    evaluations = {}
    if evaluations_file.exists():
        with open(evaluations_file, 'r') as f:
            for line in f:
                eval_data = json.loads(line)
                task_id = eval_data.get("task_id")
                if task_id:
                    evaluations[task_id] = eval_data

    # Merge tasks with evaluations
    for task in tasks:
        task_id = task.get("task_id")
        # Inject task market value if available
        if task_id and task_id in TASK_VALUES:
            task["task_value_usd"] = TASK_VALUES[task_id]
        if task_id in evaluations:
            task["evaluation"] = evaluations[task_id]
            task["completed"] = True
            task["payment"] = evaluations[task_id].get("payment", 0)
            task["feedback"] = evaluations[task_id].get("feedback", "")
            task["evaluation_score"] = evaluations[task_id].get("evaluation_score", None)  # 0.0-1.0 scale
            task["evaluation_method"] = evaluations[task_id].get("evaluation_method", "heuristic")
        else:
            task["completed"] = False
            task["payment"] = 0
            task["evaluation_score"] = None

    return {"tasks": tasks}


@app.get("/api/agents/{signature}/terminal-log/{date}")
async def get_terminal_log(signature: str, date: str, request: Request, _: None = Depends(require_read_auth)):
    """Get terminal log for an agent on a specific date"""
    if not re.fullmatch(r"^\d{4}-\d{2}-\d{2}$", date):
        raise HTTPException(status_code=400, detail="Invalid date format")

    data_path = _get_tenant_paths(request)["data_path"]
    agent_dir = data_path / signature
    if not agent_dir.exists():
        raise HTTPException(status_code=404, detail="Agent not found")
    log_file = agent_dir / "terminal_logs" / f"{date}.log"
    if not log_file.exists():
        raise HTTPException(status_code=404, detail="Log not found")

    max_bytes = max(1024, MAX_TERMINAL_LOG_BYTES)
    file_size = log_file.stat().st_size
    truncated = file_size > max_bytes
    with open(log_file, "rb") as f:
        if truncated:
            f.seek(max(0, file_size - max_bytes))
        raw = f.read(max_bytes)
    content = raw.decode("utf-8", errors="replace")

    return {
        "date": date,
        "content": content,
        "truncated": truncated,
        "bytes_returned": len(raw),
        "file_size_bytes": file_size,
    }


@app.get("/api/agents/{signature}/learning")
async def get_agent_learning(signature: str, request: Request, _: None = Depends(require_read_auth)):
    """Get agent's learning memory"""
    data_path = _get_tenant_paths(request)["data_path"]
    agent_dir = data_path / signature

    if not agent_dir.exists():
        raise HTTPException(status_code=404, detail="Agent not found")

    memory_file = agent_dir / "memory" / "memory.jsonl"

    if not memory_file.exists():
        return {"memory": "", "entries": []}

    # Parse JSONL format
    entries = []
    with open(memory_file, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                entry = json.loads(line)
                entries.append({
                    "topic": entry.get("topic", "Unknown"),
                    "timestamp": entry.get("timestamp", ""),
                    "date": entry.get("date", ""),
                    "content": entry.get("knowledge", "")
                })

    # Create a summary memory content
    memory_content = "\n\n".join([
        f"## {entry['topic']} ({entry['date']})\n{entry['content']}"
        for entry in entries
    ])

    return {
        "memory": memory_content,
        "entries": entries
    }


@app.get("/api/agents/{signature}/economic")
async def get_agent_economic(signature: str, request: Request, _: None = Depends(require_read_auth)):
    """Get economic metrics for an agent"""
    data_path = _get_tenant_paths(request)["data_path"]
    agent_dir = data_path / signature

    if not agent_dir.exists():
        raise HTTPException(status_code=404, detail="Agent not found")

    balance_file = agent_dir / "economic" / "balance.jsonl"

    if not balance_file.exists():
        raise HTTPException(status_code=404, detail="No economic data found")

    dates = []
    balance_history = []
    token_costs = []
    work_income = []

    with open(balance_file, 'r') as f:
        for line in f:
            data = json.loads(line)
            dates.append(data.get("date", ""))
            balance_history.append(data.get("balance", 0))
            token_costs.append(data.get("daily_token_cost", 0))
            work_income.append(data.get("work_income_delta", 0))

    latest = json.loads(line) if line else {}

    return {
        "balance": latest.get("balance", 0),
        "total_token_cost": latest.get("total_token_cost", 0),
        "total_work_income": latest.get("total_work_income", 0),
        "net_worth": latest.get("net_worth", 0),
        "survival_status": latest.get("survival_status", "unknown"),
        "dates": dates,
        "balance_history": balance_history,
        "token_costs": token_costs,
        "work_income": work_income
    }


@app.get("/api/leaderboard")
async def get_leaderboard(request: Request, _: None = Depends(require_read_auth)):
    """Get leaderboard data for all agents with summary metrics and balance histories"""
    data_path = _get_tenant_paths(request)["data_path"]
    if not data_path.exists():
        return {"agents": []}

    agents = []

    for agent_dir in data_path.iterdir():
        if not agent_dir.is_dir():
            continue

        signature = agent_dir.name

        # Load balance history
        balance_file = agent_dir / "economic" / "balance.jsonl"
        balance_history = []
        if balance_file.exists():
            with open(balance_file, 'r') as f:
                for line in f:
                    if line.strip():
                        balance_history.append(json.loads(line))

        if not balance_history:
            continue

        latest = balance_history[-1]
        initial_balance = balance_history[0].get("balance", 0)
        current_balance = latest.get("balance", 0)
        pct_change = ((current_balance - initial_balance) / initial_balance * 100) if initial_balance else 0

        # Load evaluation scores
        evaluations_file = agent_dir / "work" / "evaluations.jsonl"
        evaluation_scores = []
        if evaluations_file.exists():
            with open(evaluations_file, 'r') as f:
                for line in f:
                    if line.strip():
                        eval_data = json.loads(line)
                        score = eval_data.get("evaluation_score")
                        if score is not None:
                            evaluation_scores.append(score)

        avg_eval_score = (sum(evaluation_scores) / len(evaluation_scores)) if evaluation_scores else None

        # Strip balance history to essential fields, exclude initialization
        stripped_history = [
            {
                "date": entry.get("date"),
                "balance": entry.get("balance", 0),
                "task_completion_time_seconds": entry.get("task_completion_time_seconds"),
            }
            for entry in balance_history
            if entry.get("date") != "initialization"
        ]

        agents.append({
            "signature": signature,
            "initial_balance": initial_balance,
            "current_balance": current_balance,
            "pct_change": round(pct_change, 1),
            "total_token_cost": latest.get("total_token_cost", 0),
            "total_work_income": latest.get("total_work_income", 0),
            "net_worth": latest.get("net_worth", 0),
            "survival_status": latest.get("survival_status", "unknown"),
            "num_tasks": len(evaluation_scores),
            "avg_eval_score": avg_eval_score,
            "balance_history": stripped_history,
        })

    # Sort by current_balance descending
    agents.sort(key=lambda a: a["current_balance"], reverse=True)

    return {"agents": agents}


ARTIFACT_EXTENSIONS = {'.pdf', '.docx', '.xlsx', '.pptx'}
ARTIFACT_MIME_TYPES = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}


@app.get("/api/artifacts/random")
async def get_random_artifacts(
    request: Request,
    count: int = Query(default=30, ge=1, le=100),
    _: None = Depends(require_read_auth),
):
    """Get a random sample of agent-produced artifact files"""
    data_path = _get_tenant_paths(request)["data_path"]
    if not data_path.exists():
        return {"artifacts": []}

    artifacts = []
    for agent_dir in data_path.iterdir():
        if not agent_dir.is_dir():
            continue
        sandbox_dir = agent_dir / "sandbox"
        if not sandbox_dir.exists():
            continue
        signature = agent_dir.name
        for date_dir in sandbox_dir.iterdir():
            if not date_dir.is_dir():
                continue
            for file_path in date_dir.rglob("*"):
                if not file_path.is_file():
                    continue
                # Skip code_exec, videos, and reference_files directories
                rel_parts = file_path.relative_to(date_dir).parts
                if any(p in ('code_exec', 'videos', 'reference_files') for p in rel_parts):
                    continue
                ext = file_path.suffix.lower()
                if ext not in ARTIFACT_EXTENSIONS:
                    continue
                rel_path = str(file_path.relative_to(data_path))
                artifacts.append({
                    "agent": signature,
                    "date": date_dir.name,
                    "filename": file_path.name,
                    "extension": ext,
                    "size_bytes": file_path.stat().st_size,
                    "path": rel_path,
                })

    if len(artifacts) > count:
        artifacts = random.sample(artifacts, count)

    return {"artifacts": artifacts}


@app.get("/api/artifacts/file")
async def get_artifact_file(
    request: Request,
    path: str = Query(...),
    _: None = Depends(require_read_auth),
):
    """Serve an artifact file for preview/download"""
    if not path or "\x00" in path:
        raise HTTPException(status_code=400, detail="Invalid path")

    requested_path = Path(path)
    if requested_path.is_absolute() or ".." in requested_path.parts:
        raise HTTPException(status_code=400, detail="Invalid path")

    data_root = _get_tenant_paths(request)["data_path"].resolve()
    file_path = (data_root / requested_path).resolve()
    # Ensure resolved path is within DATA_PATH
    if file_path != data_root and data_root not in file_path.parents:
        raise HTTPException(status_code=403, detail="Access denied")

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    ext = file_path.suffix.lower()
    if ext not in ARTIFACT_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported artifact type")
    media_type = ARTIFACT_MIME_TYPES.get(ext, 'application/octet-stream')
    return FileResponse(file_path, media_type=media_type)


@app.get("/api/settings/hidden-agents")
async def get_hidden_agents(request: Request, _: None = Depends(require_read_auth)):
    """Get list of hidden agent signatures"""
    hidden_agents_path = _get_tenant_paths(request)["hidden_agents_path"]
    if hidden_agents_path.exists():
        with open(hidden_agents_path, 'r') as f:
            hidden = json.load(f)
        return {"hidden": hidden}
    return {"hidden": []}


@app.put("/api/settings/hidden-agents")
async def set_hidden_agents(request: Request, body: dict, _: None = Depends(require_write_auth)):
    """Set list of hidden agent signatures"""
    hidden_agents_path = _get_tenant_paths(request)["hidden_agents_path"]
    hidden = body.get("hidden", [])
    hidden_agents_path.parent.mkdir(parents=True, exist_ok=True)
    with open(hidden_agents_path, 'w') as f:
        json.dump(hidden, f)
    _audit_log(request, action="settings.hidden_agents.update", status="allowed", details={"count": len(hidden)})
    return {"status": "ok"}

@app.get("/api/settings/displaying-names")
async def get_displaying_names(request: Request, _: None = Depends(require_read_auth)):
    """Get display name mapping {signature: display_name}"""
    displaying_names_path = _get_tenant_paths(request)["displaying_names_path"]
    if displaying_names_path.exists():
        with open(displaying_names_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates"""
    tenant_id = (websocket.headers.get(TENANT_HEADER) or websocket.query_params.get("tenant_id") or "").strip()
    if not tenant_id:
        if REQUIRE_TENANT_CONTEXT:
            await websocket.close(code=1008)
            return
        tenant_id = "default"
    if not TENANT_ID_PATTERN.fullmatch(tenant_id):
        await websocket.close(code=1008)
        return
    tenant_key = _tenant_key(tenant_id)

    if REQUIRE_READ_AUTH:
        auth_header = websocket.headers.get("authorization", "")
        token = _extract_auth_token(
            authorization=auth_header,
            x_clawwork_token=websocket.headers.get("x-clawwork-token"),
        )
        if not _validate_api_token(token):
            await websocket.close(code=1008)
            return

    await manager.connect(websocket, tenant_key=tenant_key)
    try:
        # Send initial connection message
        await websocket.send_json({
            "type": "connected",
            "message": "Connected to LiveBench real-time updates"
        })

        # Keep connection alive and listen for messages
        while True:
            data = await websocket.receive_text()
            # Echo back for now, in production this would handle commands
            await websocket.send_json({
                "type": "echo",
                "data": data
            })
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.post("/api/broadcast")
async def broadcast_message(request: Request, message: dict, _: None = Depends(require_write_auth)):
    """
    Endpoint for LiveBench to broadcast updates to connected clients
    This should be called by the LiveAgent during execution
    """
    tenant_key = _get_tenant_paths(request)["tenant_key"]
    await manager.broadcast(message, tenant_key=tenant_key)
    _audit_log(request, action="broadcast.send", status="allowed")
    return {"status": "broadcast sent"}


# File watcher for live updates (optional, for when agents are running)
async def watch_agent_files():
    """
    Watch agent data files for changes and broadcast updates
    This runs as a background task
    """
    import time
    last_modified = {}

    while True:
        try:
            if TENANTS_ROOT.exists():
                for tenant_dir in TENANTS_ROOT.iterdir():
                    if not tenant_dir.is_dir():
                        continue

                    tenant_key = tenant_dir.name
                    tenant_data_path = tenant_dir / "agent_data"
                    if not tenant_data_path.exists():
                        continue

                    for agent_dir in tenant_data_path.iterdir():
                        if not agent_dir.is_dir():
                            continue

                        signature = agent_dir.name

                        # Check balance file
                        balance_file = agent_dir / "economic" / "balance.jsonl"
                        if balance_file.exists():
                            mtime = balance_file.stat().st_mtime
                            key = f"{tenant_key}:{signature}_balance"

                            if key not in last_modified or mtime > last_modified[key]:
                                last_modified[key] = mtime

                                # Read latest balance
                                with open(balance_file, 'r') as f:
                                    lines = f.readlines()
                                    if lines:
                                        data = json.loads(lines[-1])
                                        await manager.broadcast({
                                            "type": "balance_update",
                                            "signature": signature,
                                            "data": data
                                        }, tenant_key=tenant_key)

                        # Check decisions file
                        decision_file = agent_dir / "decisions" / "decisions.jsonl"
                        if decision_file.exists():
                            mtime = decision_file.stat().st_mtime
                            key = f"{tenant_key}:{signature}_decision"

                            if key not in last_modified or mtime > last_modified[key]:
                                last_modified[key] = mtime

                                # Read latest decision
                                with open(decision_file, 'r') as f:
                                    lines = f.readlines()
                                    if lines:
                                        data = json.loads(lines[-1])
                                        await manager.broadcast({
                                            "type": "activity_update",
                                            "signature": signature,
                                            "data": data
                                        }, tenant_key=tenant_key)
        except Exception as e:
            print(f"Error watching files: {e}")

        await asyncio.sleep(1)  # Check every second


@app.on_event("startup")
async def startup_event():
    """Start background tasks on startup"""
    asyncio.create_task(watch_agent_files())


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
