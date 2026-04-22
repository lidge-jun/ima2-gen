import { BillingBar } from "./BillingBar";
import { ProviderSelect } from "./ProviderSelect";
import { ModeTabs } from "./ModeTabs";
import { UploadZone } from "./UploadZone";
import { PromptInput } from "./PromptInput";
import { GenerateButton } from "./GenerateButton";
import { HistoryStrip } from "./HistoryStrip";

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="logo">
        <div className="logo-dot" />
        Image Gen
        <span className="logo-badge">gpt-image-2</span>
      </div>
      <BillingBar />
      <ProviderSelect />
      <ModeTabs />
      <UploadZone />
      <PromptInput />
      <GenerateButton />
      <HistoryStrip />
    </aside>
  );
}
