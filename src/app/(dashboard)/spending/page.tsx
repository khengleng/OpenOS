import { createClient } from '@/lib/supabase/server'
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { AddExpenseDialog } from '@/components/spending/add-expense-dialog'

export default async function SpendingPage() {
    const supabase = await createClient()
    const { data: expenses } = await supabase.from('expenses').select('*').order('created_at', { ascending: false })

    const totalSpent = expenses?.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0) || 0

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Spending</h2>
                    <p className="text-muted-foreground">The Flow — Track your wealth.</p>
                </div>
                <AddExpenseDialog />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${totalSpent.toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground">+20.1% from last month</p>
                    </CardContent>
                </Card>
            </div>

            <div className="rounded-md border">
                <div className="w-full overflow-auto">
                    <table className="w-full caption-bottom text-sm">
                        <thead className="[&_tr]:border-b">
                            <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Description</th>
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Category</th>
                                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="[&_tr:last-child]:border-0">
                            {expenses?.map((expense) => (
                                <tr key={expense.id} className="border-b transition-colors hover:bg-muted/50">
                                    <td className="p-4 align-middle">{expense.description || '-'}</td>
                                    <td className="p-4 align-middle">{expense.category}</td>
                                    <td className="p-4 align-middle text-right">${expense.amount}</td>
                                </tr>
                            ))}
                            {expenses?.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="p-4 text-center text-muted-foreground">No expenses logged yet.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
