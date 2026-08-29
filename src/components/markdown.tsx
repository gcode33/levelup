"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

// Renders LLM-generated markdown safely: rehype-sanitize strips scripts and
// on* handlers; react-markdown emits React elements with no raw HTML injection.
// `node` is the HAST element react-markdown passes to custom renderers; we strip
// it so it never reaches the DOM as an unknown prop.
/* eslint-disable @typescript-eslint/no-unused-vars */
const components: Components = {
  h1: ({ node, ...props }) => <h1 className="mb-2 mt-5 text-2xl font-semibold" {...props} />,
  h2: ({ node, ...props }) => <h2 className="mb-2 mt-4 text-xl font-semibold" {...props} />,
  h3: ({ node, ...props }) => <h3 className="mb-1 mt-3 text-lg font-semibold" {...props} />,
  h4: ({ node, ...props }) => <h4 className="mb-1 mt-2 text-base font-semibold" {...props} />,
  p: ({ node, ...props }) => <p className="my-2 leading-relaxed" {...props} />,
  ul: ({ node, ...props }) => <ul className="my-2 list-disc pl-6" {...props} />,
  ol: ({ node, ...props }) => <ol className="my-2 list-decimal pl-6" {...props} />,
  li: ({ node, ...props }) => <li className="my-1" {...props} />,
  a: ({ node, ...props }) => (
    <a
      className="text-blue-600 underline"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  code: ({ node, ...props }) => <code className="font-mono text-[0.9em]" {...props} />,
  pre: ({ node, ...props }) => (
    <pre
      className="my-3 overflow-x-auto rounded-lg bg-black/5 p-3 font-mono text-sm dark:bg-white/10"
      {...props}
    />
  ),
  blockquote: ({ node, ...props }) => (
    <blockquote
      className="my-3 border-l-4 border-black/10 pl-3 text-zinc-600 dark:border-white/10 dark:text-zinc-300"
      {...props}
    />
  ),
  strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />,
  hr: ({ node, ...props }) => <hr className="my-4 border-black/10 dark:border-white/10" {...props} />,
};
/* eslint-enable @typescript-eslint/no-unused-vars */

export default function Markdown({ children }: { children: string }) {
  return (
    <div className="text-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
