import {
  FloatingOverlay,
  type FloatingOverlayProps,
  type FloatingOverlayRenderTriggerProps
} from "../FloatingOverlay";

export type PopoverRenderTriggerProps = FloatingOverlayRenderTriggerProps;
export type PopoverProps = FloatingOverlayProps;

export function Popover(props: PopoverProps) {
  return <FloatingOverlay {...props} />;
}
