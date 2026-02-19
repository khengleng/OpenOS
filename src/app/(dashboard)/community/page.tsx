import { createClient } from '@/lib/supabase/server'
import { Card, CardHeader, CardContent, CardTitle, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CreatePostDialog } from '@/components/community/create-post-dialog'

export default async function CommunityPage() {
    const supabase = await createClient()
    const { data: posts } = await supabase.from('local_posts').select('*').order('created_at', { ascending: false })
    const allPosts = posts || []
    const borrowCount = allPosts.filter((post) => post.post_type === 'borrow').length
    const lendCount = allPosts.filter((post) => post.post_type === 'lend').length
    const alertCount = allPosts.filter((post) => post.post_type === 'alert').length

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">The Mesh</h2>
                    <p className="text-muted-foreground">Hyper-local community connection.</p>
                </div>
                <CreatePostDialog />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Borrow Requests</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">{borrowCount}</CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Lend Offers</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">{lendCount}</CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Local Alerts</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">{alertCount}</CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                {allPosts.map((post) => (
                    <Card key={post.id} className="flex flex-col">
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <CardTitle className="text-lg">{post.title}</CardTitle>
                                <Badge variant={post.post_type === 'alert' ? 'destructive' : 'default'}>
                                    {post.post_type}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">{post.content}</p>
                        </CardContent>
                        <CardFooter className="mt-auto text-xs text-muted-foreground">
                            Posted {new Date(post.created_at).toLocaleDateString()}
                        </CardFooter>
                    </Card>
                ))}
                {allPosts.length === 0 && (
                    <div className="col-span-full text-center p-8 border rounded-lg border-dashed text-muted-foreground">
                        The Mesh is live, but there is no nearby activity yet. Create the first neighborhood post.
                    </div>
                )}
            </div>
        </div>
    );
}
