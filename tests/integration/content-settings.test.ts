import { db } from "@/lib/db";
import { getContent, updateContent, getAllContent } from "@/server/services/content";
import { getSettings, updateSettings } from "@/server/services/settings";
import { ForbiddenError } from "@/lib/rbac";
import { getBlockDef } from "@/lib/content/registry";
import { DEFAULT_SETTINGS } from "@/lib/settings/schema";
import { resetDb, makeUser } from "./helpers";

beforeEach(resetDb);
afterAll(() => db.$disconnect());

describe("editable page content (FR-ADM-048, BO-5)", () => {
  it("returns defaults when nothing has been saved", async () => {
    expect(await getContent("home.hero")).toEqual(getBlockDef("home.hero")!.defaults);
  });

  it("lets an editor change a section and reads the change back", async () => {
    const editor = await makeUser("EDITOR");
    const data = { ...getBlockDef("home.hero")!.defaults, headline: "Own land you have verified" };
    const r = await updateContent({ id: editor.id, role: "EDITOR" }, "home.hero", data);
    expect(r.ok).toBe(true);
    expect((await getContent("home.hero")).headline).toBe("Own land you have verified");
  });

  it("records before and after in the audit log (FR-ADM-052)", async () => {
    const editor = await makeUser("EDITOR");
    const data = { ...getBlockDef("about.missionVision")!.defaults, mission: "New mission" };
    await updateContent({ id: editor.id, role: "EDITOR" }, "about.missionVision", data);
    const entry = await db.auditLog.findFirstOrThrow({ where: { entityType: "ContentBlock", entityId: "about.missionVision" } });
    expect(entry.actorId).toBe(editor.id);
    expect((entry.after as { mission: string }).mission).toBe("New mission");
  });

  it("returns field errors and saves nothing for invalid data", async () => {
    const editor = await makeUser("EDITOR");
    const r = await updateContent({ id: editor.id, role: "EDITOR" }, "home.hero", { headline: "" });
    expect(r.ok).toBe(false);
    expect(await db.contentBlock.count()).toBe(0);
  });

  it("forbids an Advisor from editing content", async () => {
    const advisor = await makeUser("ADVISOR");
    await expect(updateContent({ id: advisor.id, role: "ADVISOR" }, "home.hero", getBlockDef("home.hero")!.defaults)).rejects.toThrow(ForbiddenError);
  });

  it("getAllContent resolves several keys in one query", async () => {
    const all = await getAllContent(["home.hero", "home.why"]);
    expect(all["home.hero"].headline).toBeTruthy();
    expect(all["home.why"].items.length).toBeGreaterThan(0);
  });
});

describe("site settings (FR-ADM-047, US-MKT-06, TC-ADM-027)", () => {
  it("returns Zenorra Limited defaults before anything is saved", async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("lets an administrator change the phone number once for the whole site", async () => {
    const admin = await makeUser("ADMINISTRATOR");
    const r = await updateSettings({ id: admin.id, role: "ADMINISTRATOR" }, { ...DEFAULT_SETTINGS, phone: "0803 992 1140" });
    expect(r.ok).toBe(true);
    expect((await getSettings()).phone).toBe("0803 992 1140");
  });

  it("forbids an Editor from changing settings (US-EDT-05)", async () => {
    const editor = await makeUser("EDITOR");
    await expect(updateSettings({ id: editor.id, role: "EDITOR" }, DEFAULT_SETTINGS)).rejects.toThrow(ForbiddenError);
  });
});

describe("audit log immutability (TC-ADM-028)", () => {
  it("rejects UPDATE and DELETE at the database", async () => {
    const admin = await makeUser("SUPER_ADMIN");
    await updateSettings({ id: admin.id, role: "SUPER_ADMIN" }, DEFAULT_SETTINGS);
    const entry = await db.auditLog.findFirstOrThrow();
    await expect(db.auditLog.update({ where: { id: entry.id }, data: { action: "tampered" } })).rejects.toThrow();
    await expect(db.auditLog.delete({ where: { id: entry.id } })).rejects.toThrow();
  });
});
