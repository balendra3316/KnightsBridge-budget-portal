"use client";

import { useState, useTransition, useRef } from "react";
import {
  saveBudgetEntries,
  createDraftFromBudget,
  sendForReview,
  addService,
  addSubService,
  deleteService,
} from "@/app/budget/actions";
import {
  computeInvoice,
  RATE_OPTIONS,
  PARENT_SERVICE_NAMES,
  catalogChildren,
} from "@/lib/commission";

type Service = {
  id: string;
  service_name: string;
  service_type: string;
  credit_card: string;
  parent_service_id: string | null;
  sort_order: number;
};
type BudgetEntry = {
  service_id: string;
  billing_month: string;
  amount: number;
};
type LineItem = { name: string; amount: number; card?: string };
type InvoiceInfo = {
  id: string;
  invoice_number: string;
  status: string;
  billing_month: string;
  commission_amount: number | null;
  invoice_total: number | null;
  monthly_total: number | null;
  line_items: LineItem[] | null;
};

// A month is "frozen" once its invoice has left the editable stage (draft/rejected).
// Frozen months render from their line_items snapshot; editable months render live.
const isEditableStatus = (status: string | undefined) =>
  !status || status === "draft" || status === "rejected";
type Client = {
  id: string;
  name: string;
  project_name: string | null;
  parent_group: string | null;
  region: string | null;
  tags: string[] | null;
  team: string | null;
  commission_rate: number;
  billing_pattern: string;
  notes: string[] | null;
};
type Props = {
  client: Client;
  services: Service[];
  entries: BudgetEntry[];
  months: string[];
  invoices: InvoiceInfo[];
};

const CC_MAP: Record<string, { label: string; cls: string } | null> = {
  "KB Card": { label: "KB CARD", cls: "bg-kb-red-light text-kb-red" },
  "Client Card": { label: "CLIENT CARD", cls: "bg-kb-blue-light text-kb-blue" },
  "": null,
};
const SVC_DOT: Record<string, string> = {
  fee: "bg-kb-amber",
  ad: "bg-kb-coral",
  seo: "bg-kb-green",
};

function fmt(n: number) {
  if (n === 0) return "$0";
  return (
    "$" +
    n.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
  );
}

const selectCls =
  "px-2 py-1 rounded-md border border-kb-border-strong bg-kb-surface text-[11px] font-semibold text-kb-accent-text font-sans cursor-pointer outline-none";

export default function BudgetGrid({
  client,
  services,
  entries,
  months,
  invoices,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const amountsRef = useRef<Record<string, number>>({});
  const [activeMonth, setActiveMonth] = useState<string | null>(null);
  const [, forceRender] = useState(0);

  const [addMode, setAddMode] = useState<"service" | "sub" | null>(null);
  const [newSvcName, setNewSvcName] = useState(""); // chosen parent service name
  const [newSvcCC, setNewSvcCC] = useState(""); // card for the new parent service
  const [newSubSel, setNewSubSel] = useState(""); // "<parentId>::<childName>" for a sub-service

  const getAmount = (svcId: string, month: string): number => {
    const e = entries.find(
      (x) => x.service_id === svcId && x.billing_month === month
    );
    return e ? Number(e.amount) : 0;
  };
  const getCurrentAmount = (svcId: string): number => {
    if (!activeMonth) return 0;
    if (amountsRef.current[svcId] !== undefined)
      return amountsRef.current[svcId];
    return getAmount(svcId, activeMonth);
  };
  const updateAmount = (svcId: string, value: number) => {
    amountsRef.current[svcId] = value;
    forceRender((n) => n + 1);
  };
  const handleMonthClick = (month: string) => {
    if (activeMonth === month) return;
    amountsRef.current = {};
    setActiveMonth(month);
    setMsg(null);
  };

  const [rate, setRate] = useState<number>(
    (Number(client.commission_rate) || 0) / 100
  );

  // ---- Sub-service roll-up helpers ----
  // A parent that owns sub-services is totalled from those children, so editing a
  // child updates the parent (and its commission). A parent with no children keeps
  // its own entered amount.
  const childrenOf = (svcId: string) =>
    services.filter((s) => s.parent_service_id === svcId);
  const hasKids = (svcId: string) =>
    services.some((s) => s.parent_service_id === svcId);
  const savedEffective = (svcId: string, month: string): number =>
    hasKids(svcId)
      ? childrenOf(svcId).reduce((s, c) => s + getAmount(c.id, month), 0)
      : getAmount(svcId, month);
  const currentEffective = (svcId: string): number =>
    hasKids(svcId)
      ? childrenOf(svcId).reduce((s, c) => s + getCurrentAmount(c.id), 0)
      : getCurrentAmount(svcId);
  // What to persist for a service: a parent with children stores the rolled-up sum
  // so its saved amount always matches its sub-services.
  const amountToSave = (svcId: string): number =>
    hasKids(svcId) ? currentEffective(svcId) : getCurrentAmount(svcId);

  // For a FROZEN month (already submitted), its line_items snapshot is the source of
  // truth for what each parent service was billed — keyed by name — so the month keeps
  // showing the exact services it held even after they're added/removed later. Returns
  // null for editable / un-invoiced months, which render from live budget entries.
  const frozenLineMap = (month: string): Map<string, number> | null => {
    const inv = invoices.find((i) => i.billing_month === month);
    if (!inv || isEditableStatus(inv.status)) return null;
    const items = inv.line_items;
    if (!items || items.length === 0) return null;
    const map = new Map<string, number>();
    for (const li of items) {
      if (li.name === "Commission") continue; // derived row, not a service
      map.set(li.name, Number(li.amount) || 0);
    }
    return map;
  };

  const computeMonthTotal = (month: string) =>
    services
      .filter((s) => !s.parent_service_id)
      .reduce((sum, s) => sum + savedEffective(s.id, month), 0);

  // Invoice/commission preview for any month, computed from its saved budget
  // entries — lets those rows show without having to click into the month.
  const monthCalc = (month: string) =>
    computeInvoice(
      services.map((s) => ({
        id: s.id,
        service_type: s.service_type,
        credit_card: s.credit_card,
        parent_service_id: s.parent_service_id,
        amount: getAmount(s.id, month),
      })),
      rate
    );

  const currentLines = activeMonth
    ? services.map((s) => ({
        id: s.id,
        service_type: s.service_type,
        credit_card: s.credit_card,
        parent_service_id: s.parent_service_id,
        amount: getCurrentAmount(s.id),
      }))
    : [];
  const calc = activeMonth
    ? computeInvoice(currentLines, rate)
    : {
        feeLines: 0,
        clientCardAd: 0,
        kbCardAd: 0,
        monthlyTotal: 0,
        commission: 0,
        invoiceTotal: 0,
        netSpend: 0,
        kbKeeps: 0,
      };

  const activeInvoice = activeMonth
    ? invoices.find((i) => i.billing_month === activeMonth) ?? null
    : null;
  const invoiceStatus = activeInvoice?.status;
  const editable =
    activeMonth &&
    (!activeInvoice ||
      invoiceStatus === "draft" ||
      invoiceStatus === "rejected");

  const canEditServices = !!editable;

  const topServices = services.filter((s) => !s.parent_service_id);

  // Each parent, followed immediately by its own sub-services (grey-dot children).
  const orderedServices = (() => {
    const byOrder = (a: Service, b: Service) => a.sort_order - b.sort_order;
    const tops = [...topServices].sort(byOrder);
    const out: Service[] = [];
    for (const t of tops) {
      out.push(t);
      out.push(
        ...services.filter((s) => s.parent_service_id === t.id).sort(byOrder)
      );
    }
    // Any orphaned sub-services (parent removed) go last so nothing disappears.
    const placed = new Set(out.map((s) => s.id));
    for (const s of services) if (!placed.has(s.id)) out.push(s);
    return out;
  })();

  // Services billed in a FROZEN month but since deleted from the client's live list are
  // resurrected as read-only "ghost" rows (from those invoices' line_items) so submitted
  // months never lose a service. Only frozen invoices contribute ghosts — editable months
  // reflect the live list directly.
  const ghostRows: Service[] = (() => {
    const liveNames = new Set(services.map((s) => s.service_name));
    const seen = new Set<string>();
    const out: Service[] = [];
    for (const inv of invoices) {
      if (isEditableStatus(inv.status)) continue;
      for (const li of inv.line_items ?? []) {
        if (li.name === "Commission") continue;
        if (liveNames.has(li.name) || seen.has(li.name)) continue;
        seen.add(li.name);
        out.push({
          id: `ghost:${li.name}`,
          service_name: li.name,
          service_type: "fee",
          credit_card: li.card ?? "",
          parent_service_id: null,
          sort_order: 9999,
        });
      }
    }
    return out;
  })();
  const renderedServices = [...orderedServices, ...ghostRows];

  // Catalog-driven option lists for the Add forms.
  const existingTopNames = new Set(topServices.map((s) => s.service_name));
  const availableServiceNames = PARENT_SERVICE_NAMES.filter(
    (n) => !existingTopNames.has(n)
  );
  // Sub-services are grouped under the client's existing parents; the parent id is
  // baked into each option value so we never need a separate parent dropdown.
  const subOptionGroups = topServices
    .map((p) => ({
      parentId: p.id,
      parentName: p.service_name,
      children: catalogChildren(p.service_name),
    }))
    .filter((g) => g.children.length > 0);

  const closeEdit = () => {
    amountsRef.current = {};
    setActiveMonth(null);
    setMsg(null);
  };
  const handleSave = () => {
    if (!activeMonth) return;
    setMsg(null);
    startTransition(async () => {
      const ents = services.map((s) => ({
        service_id: s.id,
        amount: amountToSave(s.id),
      }));
      const r = await saveBudgetEntries(client.id, activeMonth, ents);
      if (r.error) {
        setMsg(r.error);
        return;
      }
      closeEdit();
    });
  };
  const handleSaveAndDraft = () => {
    if (!activeMonth) return;
    setMsg(null);
    startTransition(async () => {
      const ents = services.map((s) => ({
        service_id: s.id,
        amount: amountToSave(s.id),
      }));
      const r1 = await saveBudgetEntries(client.id, activeMonth, ents);
      if (r1.error) {
        setMsg(r1.error);
        return;
      }
      const r2 = await createDraftFromBudget(client.id, activeMonth, rate);
      setMsg(r2.error || "Draft saved");
    });
  };
  // Submitting always saves the latest amounts and recomputes the invoice first, so the
  // totals that go out for approval reflect the current services (not a stale snapshot
  // from when the draft was first created).
  const handleSendReview = () => {
    if (!activeMonth) return;
    setMsg(null);
    startTransition(async () => {
      const ents = services.map((s) => ({
        service_id: s.id,
        amount: amountToSave(s.id),
      }));
      const r1 = await saveBudgetEntries(client.id, activeMonth, ents);
      if (r1.error) {
        setMsg(r1.error);
        return;
      }
      const r2 = await createDraftFromBudget(client.id, activeMonth, rate);
      if (r2.error) {
        setMsg(r2.error);
        return;
      }
      const r3 = await sendForReview(client.id, activeMonth);
      setMsg(r3.error || "Sent for review");
    });
  };
  const handleResubmit = () => {
    if (!activeMonth) return;
    setMsg(null);
    startTransition(async () => {
      const ents = services.map((s) => ({
        service_id: s.id,
        amount: amountToSave(s.id),
      }));
      const r1 = await saveBudgetEntries(client.id, activeMonth, ents);
      if (r1.error) {
        setMsg(r1.error);
        return;
      }
      const r2 = await createDraftFromBudget(client.id, activeMonth, rate);
      if (r2.error) {
        setMsg(r2.error);
        return;
      }
      const r3 = await sendForReview(client.id, activeMonth);
      setMsg(r3.error || "Resent for approval");
    });
  };
  const closeAdd = () => {
    setAddMode(null);
    setNewSvcName("");
    setNewSvcCC("");
    setNewSubSel("");
  };
  const handleAddService = () => {
    startTransition(async () => {
      let result: { error?: string };
      if (addMode === "sub") {
        if (!newSubSel) {
          setMsg("Pick a sub-service");
          return;
        }
        // value is "<parentId>::<childName>" — the parent is auto-detected here.
        const sep = newSubSel.indexOf("::");
        const parentId = newSubSel.slice(0, sep);
        const childName = newSubSel.slice(sep + 2);
        result = await addSubService(client.id, parentId, childName);
      } else {
        if (!newSvcName) {
          setMsg("Pick a service");
          return;
        }
        result = await addService(client.id, newSvcName, newSvcCC);
      }
      if (result.error) {
        setMsg(result.error);
        return;
      }
      closeAdd();
    });
  };
  const handleDelete = (svcId: string) => {
    setMsg(null);
    startTransition(async () => {
      const r = await deleteService(svcId);
      if (r.error) setMsg(r.error);
    });
  };

  return (
    <div className="rounded-xl mb-4 overflow-hidden bg-kb-surface border border-kb-border">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-3 flex-nowrap overflow-hidden border-b border-kb-border bg-kb-surface-alt">
        <div className="text-[15px] font-semibold tracking-tight whitespace-nowrap shrink-0">
          {client.name}
        </div>
        {client.project_name && (
          <div className="text-[13px] font-medium text-kb-fg-2 min-w-0 truncate">
            <span className="text-kb-fg-3">/ </span>
            {client.project_name}
          </div>
        )}
        {client.region && (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase bg-kb-blue-light text-kb-blue whitespace-nowrap shrink-0">
            {client.region}
          </span>
        )}
        {client.tags?.map((tag) => (
          <span
            key={tag}
            className="px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase bg-kb-coral-light text-kb-coral whitespace-nowrap shrink-0"
          >
            {tag}
          </span>
        ))}
        {client.notes?.map((note, i) => (
          <span
            key={`note-${i}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-kb-surface text-kb-fg-2 border border-kb-border whitespace-nowrap shrink-0"
          >
            {note}
          </span>
        ))}
        <div className="flex-1" />
        <div className="text-xs text-kb-fg-3 whitespace-nowrap shrink-0">
          Team:{" "}
          <strong className="font-medium text-kb-fg-2">{client.team}</strong>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left font-medium text-[11px] uppercase tracking-wider w-[320px] min-w-[320px] max-w-[320px] sticky left-0 z-[2] text-kb-fg-3 border-b border-kb-border bg-kb-surface">
                Service
              </th>
              <th className="px-3 py-2 text-center font-medium text-[11px] uppercase tracking-wider w-[120px] min-w-[120px] sticky left-[320px] z-[2] text-kb-fg-3 border-b border-kb-border bg-kb-surface">
                CC
              </th>
              {months.map((m) => {
                const isActive = m === activeMonth;
                const inv = invoices.find((i) => i.billing_month === m);
                return (
                  <th
                    key={m}
                    onClick={() => handleMonthClick(m)}
                    className={`px-3 py-2 text-right text-[11px] uppercase tracking-wider whitespace-nowrap cursor-pointer select-none min-w-[100px] border-b border-kb-border transition-colors duration-150 ${
                      isActive
                        ? "font-semibold text-kb-amber bg-kb-entry"
                        : "font-medium text-kb-fg-3 bg-kb-surface"
                    }`}
                  >
                    {m}
                    <span
                      className={`block text-[9px] font-medium tracking-normal normal-case mt-0.5 ${
                        isActive
                          ? "text-kb-amber-mid"
                          : inv
                          ? "text-kb-green"
                          : "text-kb-muted-2"
                      }`}
                    >
                      {isActive
                        ? editable
                          ? "Editing"
                          : "Locked"
                        : inv
                        ? inv.status
                        : "Click to edit"}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {renderedServices.map((svc) => {
              const isSub = !!svc.parent_service_id;
              const isGhost = svc.id.startsWith("ghost:");
              return (
                <tr key={svc.id}>
                  <td
                    className={`px-3 py-1.5 sticky left-0 z-[1] border-b border-kb-border bg-kb-surface ${
                      isSub ? "text-kb-fg-3" : "text-kb-fg"
                    }`}
                  >
                    <div
                      className={`flex items-center gap-2 min-w-0 ${
                        isSub ? "pl-5" : ""
                      }`}
                    >
                      {isSub ? (
                        <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-kb-fg-3" />
                      ) : (
                        <span
                          className={`w-1.5 h-1.5 rounded-sm shrink-0 ${
                            SVC_DOT[svc.service_type] ?? "bg-kb-fg-3"
                          }`}
                        />
                      )}
                      <span
                        className="flex-1 min-w-0 truncate whitespace-nowrap"
                        title={svc.service_name}
                      >
                        {svc.service_name}
                      </span>
                      {isSub && (
                        <span className="text-[9px] font-semibold tracking-wide uppercase rounded px-1 py-px text-kb-muted border border-kb-border">
                          sub
                        </span>
                      )}
                      {isGhost && (
                        <span
                          title="Removed from this client — kept so submitted months still show it"
                          className="text-[9px] font-semibold tracking-wide uppercase rounded px-1 py-px text-kb-fg-3 border border-kb-border"
                        >
                          removed
                        </span>
                      )}
                      <button
                        onClick={() => handleDelete(svc.id)}
                        disabled={isPending || !canEditServices || isGhost}
                        title={
                          isGhost
                            ? "Already removed — shown for submitted months only"
                            : canEditServices
                            ? "Delete"
                            : activeMonth
                            ? "Locked — this month is already submitted"
                            : "Click a draft month to edit services"
                        }
                        className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-sm leading-none disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer bg-transparent border-none text-kb-delete"
                      >
                        &times;
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-center sticky left-[320px] z-[1] border-b border-kb-border bg-kb-surface">
                    {CC_MAP[svc.credit_card] ? (
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide ${
                          CC_MAP[svc.credit_card]!.cls
                        }`}
                      >
                        {CC_MAP[svc.credit_card]!.label}
                      </span>
                    ) : (
                      <span className="text-[11px] text-kb-fg-3">&mdash;</span>
                    )}
                  </td>
                  {months.map((m) => {
                    const isActive = m === activeMonth;
                    const rollup = !isSub && hasKids(svc.id); // parent auto-summed from its sub-services
                    // Live inline editing only for a real service in an open (un-invoiced or
                    // draft/rejected) month. Ghost rows are history — never editable.
                    if (isActive && editable && !isGhost) {
                      if (rollup) {
                        return (
                          <td
                            key={m}
                            className="px-3 py-1.5 text-right border-b border-kb-border bg-kb-entry"
                          >
                            <span
                              title="Auto-summed from sub-services"
                              className="inline-block min-w-[70px] text-right px-2 py-1 font-mono text-xs font-semibold text-kb-fg-2"
                            >
                              {fmt(currentEffective(svc.id))}
                            </span>
                          </td>
                        );
                      }
                      return (
                        <td
                          key={m}
                          className="px-3 py-1.5 text-right border-b border-kb-border bg-kb-entry"
                        >
                          <EditableCell
                            defaultValue={getCurrentAmount(svc.id)}
                            onChange={(v) => updateAmount(svc.id, v)}
                          />
                        </td>
                      );
                    }
                    // Display a saved value. A FROZEN month reads its frozen line_items
                    // snapshot by name (authoritative record of what it was billed, even
                    // for since-added/removed services). Sub-services rolled into their
                    // parent, so they read their own entry. Editable / un-invoiced months
                    // fall back to the live budget entries.
                    const liMap = frozenLineMap(m);
                    const amt = isSub
                      ? getAmount(svc.id, m)
                      : liMap
                      ? liMap.get(svc.service_name) ?? 0
                      : isGhost
                      ? 0
                      : savedEffective(svc.id, m);
                    return (
                      <td
                        key={m}
                        className={`px-3 py-1.5 text-right font-mono text-xs whitespace-nowrap border-b border-kb-border text-kb-fg-2 ${
                          isActive ? "bg-kb-entry" : ""
                        }`}
                      >
                        {amt > 0 ? (
                          fmt(amt)
                        ) : (
                          <span className="text-kb-fg-3">&mdash;</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {/* Commission row */}
            <tr>
              <td className="px-3 py-1.5 font-medium text-[12px] sticky left-0 z-[1] text-kb-green border-t-2 border-t-kb-border-strong bg-kb-surface">
                Commission
              </td>
              <td className="sticky left-[320px] z-[1] border-t-2 border-t-kb-border-strong bg-kb-surface" />
              {months.map((m) => {
                const inv = invoices.find((i) => i.billing_month === m) ?? null;
                const isActive = m === activeMonth;
                const value = inv
                  ? Number(inv.commission_amount) || 0
                  : isActive
                  ? calc.commission
                  : monthCalc(m).commission;
                return (
                  <td
                    key={m}
                    className={`px-3 py-1.5 text-right font-mono text-xs text-kb-green border-t-2 border-t-kb-border-strong ${
                      isActive ? "bg-kb-entry" : ""
                    }`}
                  >
                    {value > 0 ? (
                      fmt(value)
                    ) : (
                      <span className="text-kb-muted-2">&mdash;</span>
                    )}
                  </td>
                );
              })}
            </tr>

            {/* Monthly total row */}
            <tr>
              <td className="px-3 py-2 font-semibold text-[13px] sticky left-0 z-[1] text-kb-fg bg-kb-surface">
                Monthly total
              </td>
              <td className="sticky left-[320px] z-[1] bg-kb-surface" />
              {months.map((m) => {
                const isActive = m === activeMonth;
                const inv = invoices.find((i) => i.billing_month === m) ?? null;
                const total = isActive
                  ? calc.monthlyTotal
                  : inv && inv.monthly_total != null
                  ? Number(inv.monthly_total)
                  : computeMonthTotal(m);
                return (
                  <td
                    key={m}
                    className={`px-3 py-2 text-right font-semibold font-mono text-xs ${
                      isActive
                        ? "text-kb-accent-text bg-kb-entry"
                        : "text-kb-fg"
                    }`}
                  >
                    {total > 0 ? fmt(total) : "—"}
                  </td>
                );
              })}
            </tr>

            {/* Invoice total row */}
            <tr>
              <td className="px-3 py-2 font-semibold text-[13px] sticky left-0 z-[1] text-kb-accent-text bg-kb-surface">
                Invoice total
              </td>
              <td className="sticky left-[320px] z-[1] bg-kb-surface" />
              {months.map((m) => {
                const inv = invoices.find((i) => i.billing_month === m) ?? null;
                const isActive = m === activeMonth;
                const value = inv
                  ? Number(inv.invoice_total) || 0
                  : isActive
                  ? calc.invoiceTotal
                  : monthCalc(m).invoiceTotal;
                return (
                  <td
                    key={m}
                    className={`px-3 py-2 text-right font-bold font-mono text-xs text-kb-accent-text ${
                      isActive ? "bg-kb-entry" : ""
                    }`}
                  >
                    {value > 0 ? (
                      fmt(value)
                    ) : (
                      <span className="text-kb-muted-2">&mdash;</span>
                    )}
                  </td>
                );
              })}
            </tr>

            {/* Invoice row */}
            <tr>
              <td className="px-3 py-1 pb-2 font-medium uppercase tracking-wide text-[10px] sticky left-0 z-[1] text-kb-fg-3 bg-kb-surface">
                Invoice
              </td>
              <td className="sticky left-[320px] z-[1] bg-kb-surface" />
              {months.map((m) => {
                const inv = invoices.find((i) => i.billing_month === m) ?? null;
                const isActive = m === activeMonth;
                return (
                  <td
                    key={m}
                    className={`px-3 py-1 pb-2 text-right text-[11px] ${
                      isActive ? "bg-kb-entry" : ""
                    }`}
                  >
                    {inv ? (
                      <InvoiceStatusBadge
                        status={inv.status}
                        num={inv.invoice_number}
                      />
                    ) : (
                      <span className="text-[10px] text-kb-muted-2">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Manage services */}
      <div className="px-5 py-2.5 flex items-center gap-2 flex-wrap border-t border-kb-border">
        {!canEditServices ? (
          <span className="text-[11px] text-kb-fg-3">
            {activeMonth
              ? "Locked — this month is submitted"
              : "Click a draft month to add or remove services"}
          </span>
        ) : addMode === null ? (
          <>
            <button
              onClick={() => setAddMode("service")}
              className="px-3 py-1.5 rounded text-[11px] font-semibold cursor-pointer border border-dashed border-kb-border-strong bg-transparent text-kb-accent"
            >
              + Add Service
            </button>
            <button
              onClick={() => setAddMode("sub")}
              className="px-3 py-1.5 rounded text-[11px] font-semibold cursor-pointer border border-dashed border-kb-border-strong bg-transparent text-kb-accent"
            >
              + Add Sub-Service
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2 flex-wrap w-full">
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-kb-accent-light text-kb-accent-text">
              {addMode === "service" ? "New service" : "New sub-service"}
            </span>

            {addMode === "service" ? (
              <>
                <select
                  autoFocus
                  value={newSvcName}
                  onChange={(e) => setNewSvcName(e.target.value)}
                  className={`${selectCls} flex-1 min-w-[220px] max-w-[340px]`}
                >
                  <option value="">Select service&hellip;</option>
                  {availableServiceNames.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <select
                  value={newSvcCC}
                  onChange={(e) => setNewSvcCC(e.target.value)}
                  className={selectCls}
                >
                  <option value="">No Card</option>
                  <option value="Client Card">Client Card</option>
                  <option value="KB Card">KB Card</option>
                </select>
              </>
            ) : subOptionGroups.length === 0 ? (
              <span className="text-[11px] text-kb-fg-3">
                Add a parent service that has sub-services first.
              </span>
            ) : (
              // Parent is auto-detected from the chosen option — no parent dropdown.
              <select
                autoFocus
                value={newSubSel}
                onChange={(e) => setNewSubSel(e.target.value)}
                className={`${selectCls} flex-1 min-w-[240px] max-w-[380px]`}
              >
                <option value="">Select sub-service&hellip;</option>
                {subOptionGroups.map((g) => (
                  <optgroup key={g.parentId} label={g.parentName}>
                    {g.children.map((c) => (
                      <option key={c} value={`${g.parentId}::${c}`}>
                        {c}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )}

            <button
              onClick={handleAddService}
              disabled={
                isPending || (addMode === "sub" ? !newSubSel : !newSvcName)
              }
              className="px-3.5 py-1.5 rounded text-xs font-semibold cursor-pointer disabled:opacity-50 bg-kb-accent text-white border-none"
            >
              Add
            </button>
            <button
              onClick={closeAdd}
              className="px-3 py-1.5 rounded text-xs font-semibold cursor-pointer border border-kb-delete-border bg-kb-red-light text-kb-red"
            >
              Remove
            </button>
          </div>
        )}
      </div>

      {/* Summary strip */}
      {activeMonth && (
        <div className="flex gap-4 px-5 py-2.5 text-xs items-center flex-wrap bg-kb-surface-alt border-t border-kb-border text-kb-fg-2">
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-kb-entry text-kb-amber border border-kb-entry-border">
            {activeMonth}
          </span>

          {editable ? (
            <label className="flex items-center gap-1.5">
              <span className="text-kb-fg-3">Commission</span>
              <select
                value={rate}
                onChange={(e) => setRate(parseFloat(e.target.value))}
                className={selectCls}
              >
                {RATE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-kb-accent-light text-kb-accent-text">
              Commission {rate * 100}%
            </span>
          )}

          <span className="w-px h-4 bg-kb-border" />

          <div>
            <span className="text-kb-fg-3">Fee </span>
            <span className="font-semibold font-mono text-[11px] text-kb-fg">
              {fmt(calc.feeLines)}
            </span>
          </div>
          {calc.clientCardAd > 0 && (
            <div>
              <span className="text-kb-fg-3">Client-Card ad </span>
              <span className="font-semibold font-mono text-[11px] text-kb-fg">
                {fmt(calc.clientCardAd)}
              </span>
            </div>
          )}
          {calc.kbCardAd > 0 && (
            <div>
              <span className="text-kb-fg-3">KB-Card ad </span>
              <span className="font-semibold font-mono text-[11px] text-kb-fg">
                {fmt(calc.kbCardAd)}
              </span>
            </div>
          )}
          {(calc.clientCardAd > 0 || calc.kbCardAd > 0) && rate > 0 && (
            <div>
              <span className="text-kb-fg-3">Commission </span>
              <span className="font-semibold font-mono text-[11px] text-kb-green">
                {fmt(calc.commission)}
              </span>
            </div>
          )}
          {calc.kbCardAd > 0 && rate > 0 && (
            <div>
              <span className="text-kb-fg-3">KB net spend </span>
              <span className="font-semibold font-mono text-[11px] text-kb-amber">
                {fmt(calc.netSpend)}
              </span>
            </div>
          )}

          <div className="flex-1" />

          {msg && (
            <span
              className={`text-[11px] px-2.5 py-0.5 rounded font-medium ${
                msg.includes("error") || msg.includes("No")
                  ? "bg-kb-red-light text-kb-red"
                  : "bg-kb-green-light text-kb-green"
              }`}
            >
              {msg}
            </span>
          )}

          {!isPending && (
            <button
              onClick={closeEdit}
              className="px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer border border-kb-border bg-kb-surface text-kb-fg-2"
            >
              Close
            </button>
          )}

          {isPending ? (
            <span className="text-[11px] text-kb-fg-3">Saving&hellip;</span>
          ) : !activeInvoice ? (
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer bg-kb-green text-white border-none"
              >
                Save
              </button>
              <button
                onClick={handleSaveAndDraft}
                className="px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer bg-kb-accent text-white border-none"
              >
                Create Draft
              </button>
            </div>
          ) : invoiceStatus === "draft" ? (
            <div className="flex gap-2">
              <button
                onClick={handleSaveAndDraft}
                title="Recalculate this draft from its current services & amounts"
                className="px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer bg-kb-green text-white border-none"
              >
                Save
              </button>
              <button
                onClick={handleSendReview}
                className="px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer bg-kb-accent-light text-kb-accent-text border-none"
              >
                Send for Approval
              </button>
            </div>
          ) : invoiceStatus === "review" ? (
            <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-kb-amber-light text-kb-amber">
              Under Review
            </span>
          ) : invoiceStatus === "approved" ? (
            <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-kb-green-light text-kb-green">
              Approved
            </span>
          ) : invoiceStatus === "sent" ? (
            <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-kb-blue-light text-kb-blue">
              Sent to QuickBooks
            </span>
          ) : invoiceStatus === "rejected" ? (
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-kb-red-light text-kb-red">
                Rejected
              </span>
              <button
                onClick={handleResubmit}
                className="px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer bg-kb-accent-light text-kb-accent-text border-none"
              >
                Resend for Approval
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

/* ---- Sub-components ---- */

function EditableCell({
  defaultValue,
  onChange,
}: {
  defaultValue: number;
  onChange: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(String(defaultValue));

  const commit = () => {
    setEditing(false);
    const n = parseFloat(raw.replace(/[^0-9.-]/g, ""));
    const val = isNaN(n) ? 0 : n;
    setRaw(String(val));
    onChange(val);
  };

  if (!editing) {
    return (
      <span
        onClick={() => setEditing(true)}
        className="inline-block min-w-[70px] text-right px-2 py-1 rounded font-medium font-mono text-xs cursor-text text-kb-accent-text bg-kb-editable border border-dashed border-kb-accent transition-all duration-150"
      >
        {fmt(defaultValue)}
      </span>
    );
  }

  return (
    <input
      autoFocus
      value={raw}
      onChange={(e) => setRaw(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
      }}
      className="w-[90px] text-right px-2 py-1 rounded font-mono text-xs outline-none border border-kb-accent bg-kb-surface ring-3 ring-kb-accent/15"
    />
  );
}

function InvoiceStatusBadge({ status, num }: { status: string; num: string }) {
  const colorCls: Record<string, string> = {
    draft: "text-kb-fg-2",
    review: "text-kb-amber",
    approved: "text-kb-green",
    sent: "text-kb-blue",
    rejected: "text-kb-red",
  };
  const dotCls: Record<string, string> = {
    draft: "bg-kb-muted",
    review: "bg-kb-amber-dot",
    approved: "bg-kb-green-dot",
    sent: "bg-kb-blue",
    rejected: "bg-kb-red-dot",
  };
  const labels: Record<string, string> = {
    draft: "Draft",
    review: "Review",
    approved: "Approved",
    sent: "Sent",
    rejected: "Rejected",
  };
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className="font-mono text-[11px] font-medium text-kb-accent-text">
        {num}
      </span>
      <span
        className={`inline-flex items-center gap-1 text-[10px] font-semibold whitespace-nowrap ${
          colorCls[status] ?? "text-kb-fg-2"
        }`}
      >
        <span
          className={`w-[5px] h-[5px] rounded-full inline-block ${
            dotCls[status] ?? "bg-kb-muted"
          }`}
        />
        {labels[status] ?? status}
      </span>
    </div>
  );
}
