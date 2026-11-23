"use client";
export const PREMIUM_SESSION_EVENT = "tb:premium-session";
export type ClientSession = {connected: boolean; revision: string};
/** View invalidation only. This event never authenticates an API operation. */
export function publishClientSession(connected: boolean, revision = "") {
  window.dispatchEvent(new CustomEvent<ClientSession>(PREMIUM_SESSION_EVENT, {detail: {connected, revision}}));
}
