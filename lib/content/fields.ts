// Field model for editable content blocks. The admin form is generated from these
// definitions and the same definitions build the server-side Zod validator.
import { z } from "zod";
import { isUploadedVideoUrl } from "@/lib/media/video";

export type FieldType = "text" | "textarea" | "href" | "number" | "select" | "image" | "video" | "list" | "items";

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  help?: string;
  optional?: boolean;
  max?: number;
  maxItems?: number;
  options?: { value: string; label: string }[];
  fields?: FieldDef[]; // for "items"
}

const DEFAULT_MAX: Record<FieldType, number> = {
  text: 160,
  textarea: 1200,
  href: 300,
  number: 0,
  select: 0,
  image: 500,
  video: 200,
  list: 240,
  items: 0,
};

function stringSchema(f: FieldDef) {
  const max = f.max ?? DEFAULT_MAX[f.type];
  const msg = `${f.label} must be ${max} characters or fewer.`;
  const base = z.string({ error: `${f.label} must be text.` }).trim().max(max, msg);
  return f.optional ? base : base.min(1, `${f.label} is required.`);
}

export function fieldSchema(f: FieldDef): z.ZodType {
  switch (f.type) {
    case "text":
    case "textarea":
      return stringSchema(f);
    case "href": {
      const s = stringSchema(f).refine(
        (v) => v === "" || v.startsWith("/") || v.startsWith("#") || /^https?:\/\//.test(v) || /^(tel|mailto):/.test(v),
        `${f.label} must be a site path like /properties or a full https:// link.`,
      );
      return s;
    }
    case "image":
      return z
        .string()
        .trim()
        .max(DEFAULT_MAX.image)
        .refine((v) => v === "" || v.startsWith("/media/") || v.startsWith("/brand/") || /^https:\/\//.test(v), `${f.label} must be an image from the media library.`);
    case "video":
      return z
        .string()
        .trim()
        .max(DEFAULT_MAX.video)
        .refine((v) => v === "" || isUploadedVideoUrl(v), `${f.label} must be a video from Media → Videos.`);
    case "number":
      return z.number({ error: `${f.label} must be a number.` }).finite();
    case "select": {
      const values = (f.options ?? []).map((o) => o.value);
      return z.string().refine((v) => values.includes(v), `${f.label} must be one of the listed options.`);
    }
    case "list": {
      const item = z.string().trim().min(1, `${f.label} entries cannot be empty.`).max(f.max ?? DEFAULT_MAX.list);
      return z.array(item).max(f.maxItems ?? 30, `${f.label} can hold at most ${f.maxItems ?? 30} entries.`);
    }
    case "items": {
      const shape: Record<string, z.ZodType> = {};
      for (const sub of f.fields ?? []) shape[sub.name] = sub.optional ? fieldSchema(sub).optional() : fieldSchema(sub);
      return z
        .array(z.object(shape))
        .min(f.optional ? 0 : 1, `${f.label} needs at least one entry.`)
        .max(f.maxItems ?? 20, `${f.label} can hold at most ${f.maxItems ?? 20} entries.`);
    }
  }
}

export function blockSchema(fields: FieldDef[]) {
  const shape: Record<string, z.ZodType> = {};
  for (const f of fields) shape[f.name] = f.optional ? fieldSchema(f).optional() : fieldSchema(f);
  return z.object(shape);
}
