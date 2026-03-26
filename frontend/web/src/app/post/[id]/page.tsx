import PostDetailClient from "../../client/PostDetailClient";

export default async function PostDetailPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params;
  return <PostDetailClient id={Number(id)} />;
}

