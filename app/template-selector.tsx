"use client";

import { useState, useEffect } from "react";

type TemplateField = { name: string; description: string };

type Template = {
  id: string;
  name: string;
  fields: string; // JSON string
  createdAt: string;
};

const DEFAULT_INVOICE_FIELDS: TemplateField[] = [
  { name: "invoice number", description: "unique invoice identifier" },
  { name: "due date", description: "payment deadline" },
  { name: "IBAN", description: "bank account of the payment recipient" },
  { name: "total amount", description: "total amount to pay including tax" },
];

export default function TemplateSelector({
  selectedId,
  onSelect,
  disabled,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  disabled?: boolean;
}) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showList, setShowList] = useState(false);
  const [editing, setEditing] = useState<"create" | "edit" | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formFields, setFormFields] = useState<TemplateField[]>([
    { name: "", description: "" },
  ]);
  const [error, setError] = useState("");

  async function loadTemplates() {
    try {
      const res = await fetch("/api/templates");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTemplates(data.templates);

      // If no templates exist, seed the default Invoice template
      if (data.templates.length === 0) {
        const seedRes = await fetch("/api/templates", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: "Invoice",
            fields: DEFAULT_INVOICE_FIELDS,
          }),
        });
        if (seedRes.ok) {
          const { id } = await seedRes.json();
          const reloadRes = await fetch("/api/templates");
          if (reloadRes.ok) {
            const reloadData = await reloadRes.json();
            setTemplates(reloadData.templates);
            onSelect(id);
          }
        }
      }
    } catch {
      // Silent fail — templates are optional
    } finally {
      setLoading(false);
    }
  }

  // Fetch templates on mount — setState inside loadTemplates is intentional
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { loadTemplates(); }, []);

  function getFields(t: Template): TemplateField[] {
    try {
      return JSON.parse(t.fields);
    } catch {
      return [];
    }
  }

  const selected = templates.find((t) => t.id === selectedId);
  const selectedFields = selected ? getFields(selected) : [];

  function startCreate() {
    setEditing("create");
    setEditId(null);
    setFormName("");
    setFormFields([{ name: "", description: "" }]);
    setError("");
    setShowList(false);
  }

  function startEdit(t: Template) {
    setEditing("edit");
    setEditId(t.id);
    setFormName(t.name);
    setFormFields(getFields(t));
    setError("");
    setShowList(false);
  }

  function cancelForm() {
    setEditing(null);
    setEditId(null);
    setError("");
  }

  function addField() {
    setFormFields([...formFields, { name: "", description: "" }]);
  }

  function removeField(index: number) {
    if (formFields.length <= 1) return;
    setFormFields(formFields.filter((_, i) => i !== index));
  }

  function updateField(index: number, key: "name" | "description", value: string) {
    setFormFields(
      formFields.map((f, i) => (i === index ? { ...f, [key]: value } : f))
    );
  }

  async function saveTemplate() {
    if (!formName.trim()) {
      setError("Template name is required.");
      return;
    }
    const validFields = formFields.filter((f) => f.name.trim());
    if (validFields.length === 0) {
      setError("At least one field with a name is required.");
      return;
    }

    setError("");
    try {
      if (editing === "create") {
        const res = await fetch("/api/templates", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: formName.trim(), fields: validFields }),
        });
        if (!res.ok) throw new Error();
        const { id } = await res.json();
        await loadTemplates();
        onSelect(id);
      } else if (editing === "edit" && editId) {
        const res = await fetch(`/api/templates/${editId}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: formName.trim(), fields: validFields }),
        });
        if (!res.ok) throw new Error();
        await loadTemplates();
      }
      setEditing(null);
      setEditId(null);
    } catch {
      setError("Could not save template.");
    }
  }

  async function deleteTemplate(id: string) {
    try {
      await fetch(`/api/templates/${id}`, { method: "DELETE" });
      if (selectedId === id) onSelect(null);
      await loadTemplates();
    } catch {
      // Silent fail
    }
    setShowList(false);
  }

  if (loading) {
    return (
      <div className="mt-4 h-12 animate-pulse rounded-xl bg-white/5" />
    );
  }

  // --- Inline form (create or edit) ---
  if (editing) {
    return (
      <div className="mt-4 rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
        <input
          type="text"
          value={formName}
          onChange={(e) => setFormName(e.target.value)}
          placeholder="Template name (e.g. Contract)"
          className="w-full rounded-lg border border-white/10 bg-[#0f0f15] px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-violet-500 focus:outline-none"
        />

        <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.1em] text-gray-500">
          Fields
        </div>

        <div className="mt-2 space-y-2">
          {formFields.map((f, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                value={f.name}
                onChange={(e) => updateField(i, "name", e.target.value)}
                placeholder="Field name"
                className="flex-1 rounded-lg border border-white/10 bg-[#0f0f15] px-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:border-violet-500 focus:outline-none"
              />
              <input
                type="text"
                value={f.description}
                onChange={(e) => updateField(i, "description", e.target.value)}
                placeholder="Description (optional)"
                className="flex-[1.5] rounded-lg border border-white/10 bg-[#0f0f15] px-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:border-violet-500 focus:outline-none"
              />
              <button
                onClick={() => removeField(i)}
                className={`px-2 text-sm transition ${
                  formFields.length <= 1
                    ? "text-transparent cursor-default"
                    : "text-gray-500 hover:text-red-400"
                }`}
                disabled={formFields.length <= 1}
              >
                &times;
              </button>
            </div>
          ))}
        </div>

        {error && (
          <div className="mt-2 text-xs text-red-400">{error}</div>
        )}

        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={addField}
            className="font-mono text-[11px] text-violet-400 transition hover:text-violet-300"
          >
            + Add field
          </button>
          <div className="flex gap-2">
            <button
              onClick={cancelForm}
              className="font-mono text-[11px] text-gray-500 transition hover:text-gray-300"
            >
              Cancel
            </button>
            <button
              onClick={saveTemplate}
              disabled={disabled}
              className="rounded-lg bg-violet-500 px-4 py-1.5 font-mono text-[11px] font-semibold text-white transition hover:bg-violet-400 disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Template selector ---
  return (
    <div className="mt-4">
      {/* Selected template display */}
      <div
        onClick={() => !disabled && setShowList(!showList)}
        className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 transition ${
          selectedId
            ? "border-violet-500/30 bg-violet-500/5"
            : "border-white/10 hover:border-white/25"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <div>
          <div className="text-sm text-gray-200">
            {selected ? selected.name : "Default (dates, parties, amounts)"}
          </div>
          <div className="mt-0.5 text-xs text-gray-500">
            {selected
              ? selectedFields.map((f) => f.name).join(", ")
              : "doc_type, dates, parties, amounts"}
          </div>
        </div>
        <span className="text-xs text-gray-500">&#9662;</span>
      </div>

      {/* Dropdown list */}
      {showList && (
        <div className="mt-1 rounded-xl border border-white/10 bg-[#0f0f15] py-1 shadow-xl">
          {/* Default option */}
          <div
            onClick={() => {
              onSelect(null);
              setShowList(false);
            }}
            className={`flex cursor-pointer items-center justify-between px-4 py-2.5 transition hover:bg-white/5 ${
              !selectedId ? "text-violet-300" : "text-gray-300"
            }`}
          >
            <div>
              <div className="text-sm">Default</div>
              <div className="text-xs text-gray-500">
                dates, parties, amounts
              </div>
            </div>
          </div>

          {/* Custom templates */}
          {templates.map((t) => (
            <div
              key={t.id}
              className={`flex cursor-pointer items-center justify-between px-4 py-2.5 transition hover:bg-white/5 ${
                selectedId === t.id ? "text-violet-300" : "text-gray-300"
              }`}
            >
              <div
                onClick={() => {
                  onSelect(t.id);
                  setShowList(false);
                }}
                className="flex-1 min-w-0"
              >
                <div className="text-sm">{t.name}</div>
                <div className="truncate text-xs text-gray-500">
                  {getFields(t).map((f) => f.name).join(", ")}
                </div>
              </div>
              <div className="flex gap-1 ml-2 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startEdit(t);
                  }}
                  className="px-1.5 py-1 text-[11px] text-gray-500 transition hover:text-violet-400"
                  title="Edit"
                >
                  &#9998;
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteTemplate(t.id);
                  }}
                  className="px-1.5 py-1 text-[11px] text-gray-500 transition hover:text-red-400"
                  title="Delete"
                >
                  &times;
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New template link */}
      <div className="mt-2 text-right">
        <button
          onClick={startCreate}
          disabled={disabled}
          className="font-mono text-[11px] text-violet-400 transition hover:text-violet-300 disabled:opacity-40"
        >
          + New template
        </button>
      </div>
    </div>
  );
}
