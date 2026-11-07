import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PERMISSION_ACTIONS, PERMISSION_RESOURCES, emptyGrant, validPermissionKey, type PermissionGrant } from "@/lib/permission-model";
export function PermissionMatrix({ values, onChange, disabled }: { values: Record<string, PermissionGrant>; onChange: (next: Record<string, PermissionGrant>) => void; disabled?: boolean }) {
  const [customKey, setCustomKey] = useState("");
  const resources = [...new Set([...PERMISSION_RESOURCES, ...Object.keys(values)])].filter(key => !["all_properties", "all_departments"].includes(key));
  return <div className="space-y-3">
    <p className="text-xs text-muted-foreground">View is required to open a module or perform its actions. Edit-only access means View + Edit, without Create, Delete, or Export. Administrator accounts retain all rights; use a User or Manager role for restrictions. Account/security administration remains administrator-only.</p>
    <div className="overflow-x-auto rounded-xl border"><table className="w-full text-sm"><thead><tr className="border-b bg-muted/30"><th className="p-3 text-left">Page / feature</th>{PERMISSION_ACTIONS.map(action => <th key={action.key} className="p-2 text-center">{action.label}</th>)}</tr></thead>
      <tbody>{resources.map(resource => { const grant = { ...emptyGrant(), ...values[resource] }; return <tr key={resource} className="border-b last:border-0"><th className="p-3 text-left font-medium capitalize">{resource.replace(/_/g, " ")}</th>{PERMISSION_ACTIONS.map(action => <td key={action.key} className="p-2 text-center"><Checkbox aria-label={`${resource} ${action.label}`} checked={grant[action.key]} disabled={disabled || (action.key !== "v" && !grant.v)} onCheckedChange={checked => {
        const value = Boolean(checked);
        const next = action.key === "v" && !value ? emptyGrant() : { ...grant, [action.key]: value };
        onChange({ ...values, [resource]: next });
      }} /></td>)}</tr>; })}</tbody></table></div>
    <div className="flex gap-2"><Input aria-label="Custom page or feature key" placeholder="Custom key, e.g. stock_checks" value={customKey} disabled={disabled} onChange={event => setCustomKey(event.target.value.toLowerCase())} /><Button type="button" variant="outline" disabled={disabled || !validPermissionKey(customKey) || customKey in values} onClick={() => { onChange({ ...values, [customKey]: emptyGrant() }); setCustomKey(""); }}>Add permission</Button></div>
    <p className="text-xs text-muted-foreground">Custom keys can be mapped to existing app controls with the permission checks. They do not create pages. Export rights control app download/print actions; visible information can still be copied.</p>
  </div>;
}
