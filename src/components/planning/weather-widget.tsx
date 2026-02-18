'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Cloud, Sun, CloudRain, CloudSnow, CloudLightning, Wind } from 'lucide-react'

// Simple OpenMeteo types
interface WeatherData {
    current_weather: {
        temperature: number
        windspeed: number
        winddirection: number
        weathercode: number
        time: string
    }
}

// Map WMO Weather Codes to icons/text
const getWeatherInfo = (code: number) => {
    if (code === 0) return { icon: Sun, label: 'Clear Sky' }
    if (code >= 1 && code <= 3) return { icon: Cloud, label: 'Partly Cloudy' }
    if (code >= 45 && code <= 48) return { icon: Wind, label: 'Foggy' }
    if (code >= 51 && code <= 67) return { icon: CloudRain, label: 'Drizzle' }
    if (code >= 71 && code <= 77) return { icon: CloudSnow, label: 'Snow' }
    if (code >= 80 && code <= 82) return { icon: CloudRain, label: 'Rain Showers' }
    if (code >= 95 && code <= 99) return { icon: CloudLightning, label: 'Thunderstorm' }
    return { icon: Sun, label: 'Unknown' } // Default
}

// Default to user's approx location or fallback (e.g., New York)
const DEFAULT_LAT = 40.7128
const DEFAULT_LON = -74.0060
const ROUNDING_PRECISION = 2

const roundCoordinate = (value: number) =>
    Number(value.toFixed(ROUNDING_PRECISION))

export function WeatherWidget() {
    const [weather, setWeather] = useState<WeatherData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        // Try to get user location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    fetchWeather(
                        roundCoordinate(position.coords.latitude),
                        roundCoordinate(position.coords.longitude)
                    )
                },
                (err) => {
                    console.warn("Geolocation denied/failed, using default.", err)
                    fetchWeather(DEFAULT_LAT, DEFAULT_LON)
                }
            )
        } else {
            fetchWeather(DEFAULT_LAT, DEFAULT_LON)
        }
    }, [])

    const fetchWeather = async (lat: number, lon: number) => {
        try {
            const response = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=celsius`
            )
            if (!response.ok) throw new Error('Failed to fetch weather')
            const data = await response.json()
            setWeather(data)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to fetch weather")
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <Card className="h-full animate-pulse bg-muted/40">
                <CardContent className="flex items-center justify-center p-6 h-32">
                    <span className="text-muted-foreground">Loading forecast...</span>
                </CardContent>
            </Card>
        )
    }

    if (error || !weather) {
        return (
            <Card className="h-full border-destructive/20 bg-destructive/10">
                <CardContent className="flex items-center justify-center p-6 text-destructive">
                    Failed to load weather.
                </CardContent>
            </Card>
        )
    }

    const { current_weather } = weather
    const { icon: WeatherIcon, label } = getWeatherInfo(current_weather.weathercode)

    return (
        <Card className="h-full overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 -z-10" />
            <CardContent className="p-6 flex flex-col justify-between h-full">
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="font-semibold text-lg text-foreground/80">Current Conditions</h3>
                        <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
                    </div>
                    <WeatherIcon className="w-10 h-10 text-primary animate-in fade-in zoom-in duration-500" />
                </div>

                <div className="mt-4 flex items-end gap-3">
                    <span className="text-4xl font-bold tracking-tighter">
                        {Math.round(current_weather.temperature)}°
                    </span>
                    <div className="flex flex-col text-sm text-muted-foreground mb-1">
                        <span>{label}</span>
                        <span className="text-xs">Wind: {current_weather.windspeed} km/h</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
