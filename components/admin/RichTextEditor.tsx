"use client";
// Tiptap editor producing structured, sanitisable HTML (FR-ADM-012, AD-5).
// Paste is reduced to the allow-listed schema — no arbitrary HTML survives.
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";

function Btn({ editor, label, title, active, onClick }: { editor: Editor; label: string; title: string; active?: boolean; onClick: () => void }) {
  return (
    <button type="button" title={title} aria-label={title} aria-pressed={active ?? false} onMouseDown={(e) => e.preventDefault()} onClick={onClick} disabled={!editor.isEditable}>
      {label}
    </button>
  );
}

export function RichTextEditor({ value, onChange, labelledBy }: { value: string; onChange: (html: string) => void; labelledBy: string }) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, codeBlock: false, link: false }),
      Link.configure({ openOnClick: false, protocols: ["http", "https", "mailto", "tel"], HTMLAttributes: { rel: "noopener noreferrer nofollow" } }),
      Image.configure({ inline: false }),
    ],
    content: value,
    editorProps: { attributes: { "aria-labelledby": labelledBy, role: "textbox", "aria-multiline": "true" } },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });
  if (!editor) return <div className="rte" aria-busy="true" />;

  const link = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = prompt("Link address (https://…)", prev ?? "https://");
    if (url === null) return;
    if (url === "") editor.chain().focus().unsetLink().run();
    else if (/^(https?:|mailto:|tel:|\/)/.test(url)) editor.chain().focus().setLink({ href: url }).run();
  };
  const image = () => {
    const src = prompt("Image address — copy it from the Media library (/media/…)");
    if (!src || !/^(\/media\/|https:\/\/)/.test(src)) return;
    const alt = prompt("Describe the image for people who can't see it (alt text)") ?? "";
    if (!alt.trim()) return alert("Alt text is required for images.");
    editor.chain().focus().setImage({ src, alt }).run();
  };
  const embed = () => {
    const url = prompt("YouTube or Vimeo link");
    if (!url) return;
    const yt = url.match(/(?:youtu\.be\/|v=)([\w-]{11})/);
    const vm = url.match(/vimeo\.com\/(\d+)/);
    const src = yt ? `https://www.youtube-nocookie.com/embed/${yt[1]}` : vm ? `https://player.vimeo.com/video/${vm[1]}` : null;
    if (!src) return alert("Only YouTube and Vimeo links can be embedded.");
    editor.chain().focus().insertContent(`<p><a href="${src}">Watch the video</a></p>`).run();
  };

  return (
    <div>
      <div className="toolbar" role="toolbar" aria-label="Formatting">
        <Btn editor={editor} label="H2" title="Heading" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
        <Btn editor={editor} label="H3" title="Subheading" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
        <Btn editor={editor} label="¶" title="Paragraph" active={editor.isActive("paragraph")} onClick={() => editor.chain().focus().setParagraph().run()} />
        <Btn editor={editor} label="B" title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} />
        <Btn editor={editor} label="I" title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} />
        <Btn editor={editor} label="• List" title="Bulleted list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <Btn editor={editor} label="1. List" title="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
        <Btn editor={editor} label="“ Quote" title="Block quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
        <Btn editor={editor} label="Link" title="Insert or edit link" active={editor.isActive("link")} onClick={link} />
        <Btn editor={editor} label="Image" title="Insert image" onClick={image} />
        <Btn editor={editor} label="Video" title="Embed a YouTube or Vimeo video" onClick={embed} />
        <Btn editor={editor} label="↶" title="Undo" onClick={() => editor.chain().focus().undo().run()} />
        <Btn editor={editor} label="↷" title="Redo" onClick={() => editor.chain().focus().redo().run()} />
      </div>
      <div className="rte">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
