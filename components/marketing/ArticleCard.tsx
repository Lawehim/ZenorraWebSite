import Link from "next/link";
import { SiteImage, type ImageSource } from "@/components/ui/SiteImage";
import { Icon } from "@/components/ui/Icon";

export interface ArticleCardData {
  slug: string;
  title: string;
  excerpt: string | null;
  category: string | null;
  readingMinutes: number | null;
  image: ImageSource | null;
}

export function ArticleCard({ post, featured = false }: { post: ArticleCardData; featured?: boolean }) {
  return (
    <Link className={`post rv${featured ? " feature" : ""}`} href={`/insights/${post.slug}`} data-testid="article-card">
      <div className="post-art">
        <SiteImage image={post.image} brief="Article cover image" meta="16:10 · 1200×750 min" sizes="(max-width: 700px) 100vw, 400px" />
      </div>
      <div className="post-body" style={featured ? { padding: "clamp(1.6rem,3vw,2.6rem)", justifyContent: "center" } : undefined}>
        <div className="post-kicker">
          {featured && "Featured"}
          {post.category && (featured ? <span>{post.category}</span> : post.category)}
          {post.readingMinutes ? <span>{post.readingMinutes} min read</span> : null}
        </div>
        <h3 style={featured ? { fontSize: "clamp(1.5rem,2.6vw,2.1rem)" } : undefined}>{post.title}</h3>
        {post.excerpt && <p>{post.excerpt}</p>}
        <div className="more" aria-hidden="true">
          Read article <Icon name="arrow" width={15} height={15} />
        </div>
      </div>
    </Link>
  );
}
