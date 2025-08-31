// Deprecated: single-device session enforcement has been removed.
// Keep a no-op component to avoid build issues if any legacy import remains.
export function SingleDeviceGuard() { return null; }

export default SingleDeviceGuard;
