"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

export function Greeting({ name }: { name: string }) {
  const hour = useSyncExternalStore(subscribe, () => new Date().getHours(), () => -1);
  const part = hour < 0 ? "Welcome back" : hour < 5 ? "Up late" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return (
    <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
      {part}, {name}
    </h1>
  );
}
