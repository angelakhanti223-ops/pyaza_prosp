"use client";

import { useEffect } from "react";
import { useEditor, EditorContent, Extension, Node, mergeAttributes, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import {
  Bold,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Redo,
  Table as TableIcon,
  Undo,
} from "lucide-react";

// Пропускает произвольные <div style="..."> насквозь (например, цветные блоки
// «совет эксперта»/CTA, вставленные напрямую в HTML статьи в обход редактора) —
// без этого узла Tiptap/ProseMirror молча выбрасывает любые нераспознанные теги
// при разборе HTML, и такой блок необратимо терялся бы при первом же сохранении
// через этот редактор, даже если автор просто поправил соседний абзац.
const RawDiv = Node.create({
  name: "rawDiv",
  group: "block",
  content: "block+",
  parseHTML() {
    return [{ tag: "div" }];
  },
  addAttributes() {
    return {
      style: { default: null },
      class: { default: null },
    };
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes), 0];
  },
});

// RawDiv above only covers the outer wrapper — everything INSIDE it (headings,
// paragraphs, bold text, lists) is still ordinary StarterKit nodes/marks, whose
// default schema keeps only structural attributes (heading level and the like)
// and drops any inline style="..."/class="..." on parse. That silently erased
// the white text color set on <h2>/<strong> inside a dark CTA block the first
// time the article was re-saved through this editor, even though the block's
// own background survived — content looked fine in the editor (it doesn't
// carry the site's dark-on-dark contrast case) but broke once rendered live.
// Attaching style/class as global attributes on every node/mark actually used
// here fixes that for ANY future content, not just this one article.
const PreserveInlineStyle = Extension.create({
  name: "preserveInlineStyle",
  addGlobalAttributes() {
    return [
      {
        types: [
          "heading", "paragraph", "bulletList", "orderedList", "listItem",
          "blockquote", "bold", "italic", "tableCell", "tableHeader",
        ],
        attributes: {
          style: {
            default: null,
            parseHTML: (element: HTMLElement) => element.getAttribute("style"),
            renderHTML: (attributes: { style?: string | null }) =>
              attributes.style ? { style: attributes.style } : {},
          },
          class: {
            default: null,
            parseHTML: (element: HTMLElement) => element.getAttribute("class"),
            renderHTML: (attributes: { class?: string | null }) =>
              attributes.class ? { class: attributes.class } : {},
          },
        },
      },
    ];
  },
});

type ToolbarButtonProps = {
  onClick: () => void;
  active?: boolean;
  label: string;
  children: React.ReactNode;
};

function ToolbarButton({ onClick, active, label, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
        active ? "bg-navy text-white" : "text-foreground/60 hover:bg-blue-light hover:text-navy"
      }`}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  function setLink() {
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Ссылка (пусто — убрать)", previousUrl ?? "");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  function addImage() {
    const url = window.prompt("Ссылка на изображение");
    if (url) editor.chain().focus().setImage({ src: url }).run();
  }

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-t-lg border border-b-0 border-black/10 bg-blue-light/20 p-1.5">
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
        label="Жирный"
      >
        <Bold size={15} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
        label="Курсив"
      >
        <Italic size={15} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive("heading", { level: 2 })}
        label="Заголовок 2"
      >
        <Heading2 size={15} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive("heading", { level: 3 })}
        label="Заголовок 3"
      >
        <Heading3 size={15} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
        label="Маркированный список"
      >
        <List size={15} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")}
        label="Нумерованный список"
      >
        <ListOrdered size={15} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive("blockquote")}
        label="Цитата"
      >
        <Quote size={15} />
      </ToolbarButton>
      <ToolbarButton onClick={setLink} active={editor.isActive("link")} label="Ссылка">
        <LinkIcon size={15} />
      </ToolbarButton>
      <ToolbarButton onClick={addImage} label="Изображение по ссылке">
        <ImageIcon size={15} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        label="Вставить таблицу"
      >
        <TableIcon size={15} />
      </ToolbarButton>
      <div className="mx-1 h-5 w-px bg-black/10" />
      <ToolbarButton onClick={() => editor.chain().focus().undo().run()} label="Отменить">
        <Undo size={15} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().redo().run()} label="Повторить">
        <Redo size={15} />
      </ToolbarButton>
    </div>
  );
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, autolink: true }),
      Image,
      Placeholder.configure({ placeholder: placeholder ?? "Текст статьи…" }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      RawDiv,
      PreserveInlineStyle,
    ],
    content: value,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none px-3 py-2.5 text-foreground/80 prose-headings:text-navy prose-a:text-blue " +
          "prose-img:rounded-xl prose-table:text-xs min-h-[16rem] outline-none " +
          "[&_table]:border-collapse [&_td]:border [&_td]:border-black/10 [&_td]:p-2 " +
          "[&_th]:border [&_th]:border-black/10 [&_th]:bg-blue-light/40 [&_th]:p-2",
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  });

  // Внешние сбросы значения (например, при загрузке статьи после успешного
  // fetch) — Tiptap не controlled-компонент, синхронизируем вручную и только
  // когда значение реально отличается от текущего HTML, чтобы не сбрасывать
  // курсор/историю при каждом вводе.
  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div>
      <Toolbar editor={editor} />
      <div className="rounded-b-lg border border-black/10">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
