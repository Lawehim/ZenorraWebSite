"use client";
import { useState, useTransition } from "react";
import { renameCategoryAction, mergeCategoryAction, deleteCategoryAction } from "@/server/actions/phase2";

export function CategoryManager({ cats }: { cats: { id: string; name: string; count: number }[] }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <>
      {msg && (
        <p className="form-alert" role="alert">
          {msg}
        </p>
      )}
      <div className="tblwrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Name</th>
              <th>Articles</th>
              <th>Merge into</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {cats.map((c) => (
              <tr key={c.id}>
                <td>
                  <form
                    style={{ display: "flex", gap: ".4rem" }}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const name = String(new FormData(e.currentTarget).get("name") ?? "");
                      start(() => renameCategoryAction(c.id, name));
                    }}
                  >
                    <label className="sr-only" htmlFor={`cat-${c.id}`}>
                      Name for {c.name}
                    </label>
                    <input id={`cat-${c.id}`} name="name" className="inp" defaultValue={c.name} style={{ padding: ".45rem .6rem" }} />
                    <button className="btn btn-line btn-sm" type="submit" disabled={pending}>
                      Rename
                    </button>
                  </form>
                </td>
                <td className="mono">{c.count}</td>
                <td>
                  <label className="sr-only" htmlFor={`merge-${c.id}`}>
                    Merge {c.name} into
                  </label>
                  <select
                    id={`merge-${c.id}`}
                    className="inp"
                    style={{ padding: ".45rem 2rem .45rem .6rem" }}
                    defaultValue=""
                    disabled={pending}
                    onChange={(e) => {
                      const into = e.target.value;
                      if (into && confirm(`Move all ${c.count} article(s) from “${c.name}” and remove it?`)) start(() => mergeCategoryAction(c.id, into));
                    }}
                  >
                    <option value="">—</option>
                    {cats
                      .filter((o) => o.id !== c.id)
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                  </select>
                </td>
                <td>
                  <button
                    className="btn btn-danger btn-sm"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await deleteCategoryAction(c.id);
                        setMsg(r.ok ? null : r.message);
                      })
                    }
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {!cats.length && (
              <tr>
                <td colSpan={4}>No categories yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
