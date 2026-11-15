import { BlogVideo } from "@/components/blog-video";
import "./blog-video.css";
import { blogVideoUrl, safeBlogHref } from "@/lib/blog";

function Inline({ text }: { text: string }) {
  return <>{text.split(/(\[[^\]]+\]\([^\s)]+\)|https?:\/\/[^\s<>]+|www\.[^\s<>]+)/g).map((part, i) => {
    const match = part.match(/^\[([^\]]+)\]\(([^\s)]+)\)$/);
    const raw = match ? match[2] : part.replace(/[.,;:!?)}\]]+$/, "");
    const href = match ? safeBlogHref(raw) : /^(https?:\/\/|www\.)/.test(raw) ? safeBlogHref(raw.startsWith("www.") ? `https://${raw}` : raw) : null;
    return href ? <span key={i}><a href={href} className="underline decoration-current underline-offset-4 hover:opacity-75" {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{match ? match[1] : raw}</a>{match ? "" : part.slice(raw.length)}</span> : part;
  })}</>;
}
export function BlogBody({ body }: { body: string }) {
  return <div className="space-y-6 text-base leading-[1.8] [overflow-wrap:anywhere] md:text-lg">{body.split(/\n\s*\n/).filter(Boolean).map((block, index) => {
    const videoUrl = blogVideoUrl(block);
    if (videoUrl) return <BlogVideo key={index} url={videoUrl} />;
    if (block.startsWith("## ")) return <h2 key={index} className="pt-5 font-display text-3xl font-light leading-tight md:text-4xl"><Inline text={block.slice(3)} /></h2>;
    if (block.split("\n").every(line => line.startsWith("- "))) return <ul key={index} className="list-disc space-y-2 pl-6">{block.split("\n").map((line,i) => <li key={i}><Inline text={line.slice(2)} /></li>)}</ul>;
    return <p key={index} className="whitespace-pre-line"><Inline text={block} /></p>;
  })}</div>;
}
