import { CanvasToolbar } from "./CanvasToolbar";
import type { CanvasExportBackground, HexColor } from "../../types/canvas";

interface CanvasModeFloatingToolbarProps {
  annotations: any;
  backgroundCleanup: any;
  backgroundCleanupPreview: unknown;
  canvasState: {
    exportBackground: CanvasExportBackground;
    exportMatteColor: HexColor;
    isApplying: boolean;
    isExporting: boolean;
    isEditingWithMask: boolean;
  };
  actions: {
    handleApplyCanvas: () => Promise<void>;
    handleExportCanvas: () => Promise<void>;
    handleEditWithMask: () => Promise<void>;
    setExportBackground: (mode: CanvasExportBackground) => void;
    setExportMatteColor: (color: HexColor) => void;
  };
}

export function CanvasModeFloatingToolbar({
  annotations,
  backgroundCleanup,
  backgroundCleanupPreview,
  canvasState,
  actions,
}: CanvasModeFloatingToolbarProps) {
  return (
    <CanvasToolbar
      activeTool={annotations.activeTool}
      eraserMode={annotations.eraserMode}
      onEraserModeChange={annotations.setEraserMode}
      style={{ color: annotations.toolColor, strokeWidth: annotations.strokeWidth }}
      onStyleChange={annotations.setStyle}
      hasExportableContent={annotations.hasAnnotations}
      onToolChange={annotations.setTool}
      onClear={annotations.clear}
      onApply={() => void actions.handleApplyCanvas()}
      onExport={() => void actions.handleExportCanvas()}
      onUndo={annotations.undo}
      onRedo={annotations.redo}
      canUndo={annotations.canUndo}
      canRedo={annotations.canRedo}
      onDeleteSelected={annotations.deleteSelected}
      selectedCount={annotations.selectedIds.length}
      onEditWithMask={() => void actions.handleEditWithMask()}
      canEditWithMask={annotations.boxes.length > 0}
      isEditingWithMask={canvasState.isEditingWithMask}
      isApplying={canvasState.isApplying}
      isExporting={canvasState.isExporting}
      exportBackground={canvasState.exportBackground}
      exportMatteColor={canvasState.exportMatteColor}
      onExportBackgroundChange={actions.setExportBackground}
      onExportMatteColorChange={actions.setExportMatteColor}
      cleanupTolerance={backgroundCleanup.backgroundCleanupTolerance}
      cleanupSeedCount={backgroundCleanup.backgroundCleanupSeeds.length}
      cleanupStats={backgroundCleanup.backgroundCleanupStats}
      cleanupHasPreview={Boolean(backgroundCleanupPreview)}
      isCleanupPickingSeed={backgroundCleanup.isBackgroundCleanupPickingSeed}
      isCleanupActive={backgroundCleanup.isBackgroundCleanupActive}
      cleanupIntent={backgroundCleanup.cleanupIntent}
      cleanupTool={backgroundCleanup.cleanupTool}
      cleanupBrushRadius={backgroundCleanup.cleanupBrushRadius}
      isCleanupPreviewing={backgroundCleanup.isBackgroundCleanupPreviewing}
      isCleanupApplying={backgroundCleanup.isBackgroundCleanupApplying}
      onCleanupAutoSample={backgroundCleanup.handleBackgroundCleanupAutoSample}
      onCleanupPickSeed={backgroundCleanup.handleBackgroundCleanupPickSeed}
      onCleanupIntentChange={backgroundCleanup.setCleanupIntent}
      onCleanupToolChange={(tool) => {
        backgroundCleanup.setCleanupTool(tool);
        backgroundCleanup.setIsBackgroundCleanupActive(true);
      }}
      onCleanupBrushRadiusChange={backgroundCleanup.setCleanupBrushRadius}
      onCleanupToleranceChange={backgroundCleanup.handleBackgroundCleanupToleranceChange}
      onCleanupPreview={() => void backgroundCleanup.runBackgroundCleanupPreview()}
      onCleanupApply={() => void backgroundCleanup.handleBackgroundCleanupApply()}
      onCleanupReset={backgroundCleanup.handleBackgroundCleanupReset}
    />
  );
}
