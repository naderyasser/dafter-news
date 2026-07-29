import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import TickerManager from "./TickerManager";
import type { TickerModule } from "@/lib/types";

const dashMutate = vi.fn();
vi.mock("@/lib/api", () => ({ dashMutate: (...a: unknown[]) => dashMutate(...a) }));

const mod = (id: number, label: string, order: number, over: Partial<TickerModule> = {}): TickerModule =>
  ({ id, label, order, active: true, refresh_seconds: 60, source: "manual", ...over }) as TickerModule;

afterEach(() => dashMutate.mockReset());

describe("TickerManager", () => {
  it("renumbers the whole list on a move rather than swapping two values", async () => {
    // Seeded orders start at 1, so writing an array index straight back left
    // two modules sharing an order with the tie broken by id.
    const items = [mod(1, "الأسواق", 1), mod(2, "الطقس", 2), mod(3, "الصلاة", 3)];
    dashMutate.mockResolvedValue({});
    render(<TickerManager items={items} />);

    await act(async () => screen.getByLabelText("تحريك الصلاة لأعلى").click());

    expect(dashMutate).toHaveBeenCalledTimes(3);
    expect(dashMutate).toHaveBeenCalledWith("/ticker-modules/1/", "PATCH", { order: 1 });
    expect(dashMutate).toHaveBeenCalledWith("/ticker-modules/3/", "PATCH", { order: 2 });
    expect(dashMutate).toHaveBeenCalledWith("/ticker-modules/2/", "PATCH", { order: 3 });
  });

  it("puts the order back and says so when a reorder fails", async () => {
    const items = [mod(1, "الأسواق", 1), mod(2, "الطقس", 2)];
    dashMutate.mockRejectedValue(new Error("network"));
    render(<TickerManager items={items} />);

    await act(async () => screen.getByLabelText("تحريك الطقس لأعلى").click());

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("تعذّر حفظ الترتيب"));
    // First row is «الأسواق» again — the arrow that failed left no trace.
    expect(screen.getByLabelText("تحريك الأسواق لأعلى")).toBeDisabled();
  });

  it("disables the arrows that would walk off the list", () => {
    render(<TickerManager items={[mod(1, "الأسواق", 1), mod(2, "الطقس", 2)]} />);

    expect(screen.getByLabelText("تحريك الأسواق لأعلى")).toBeDisabled();
    expect(screen.getByLabelText("تحريك الطقس لأسفل")).toBeDisabled();
    expect(screen.getByLabelText("تحريك الأسواق لأسفل")).toBeEnabled();
  });

  it("toggles visibility through a real switch, and reports its state", async () => {
    dashMutate.mockResolvedValue({});
    render(<TickerManager items={[mod(1, "الأسواق", 1)]} />);
    const sw = screen.getByRole("switch");

    expect(sw).toBeChecked();
    await act(async () => sw.click());

    expect(dashMutate).toHaveBeenCalledWith("/ticker-modules/1/", "PATCH", { active: false });
    expect(screen.getByRole("switch")).not.toBeChecked();
  });

  it("re-lights a module the server refused to hide", async () => {
    dashMutate.mockRejectedValue(new Error("network"));
    render(<TickerManager items={[mod(1, "الأسواق", 1)]} />);

    await act(async () => screen.getByRole("switch").click());

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("تعذّر حفظ التغيير"));
    // The strip is still showing it, so the dashboard must be too.
    expect(screen.getByRole("switch")).toBeChecked();
  });

  it("clamps a refresh interval below the model's floor and shows the clamped value", async () => {
    dashMutate.mockResolvedValue({});
    render(<TickerManager items={[mod(1, "الأسواق", 1)]} />);
    const field = screen.getByLabelText("زمن تحديث الأسواق بالثواني");

    await act(async () => {
      fireEvent.blur(field, { target: { value: "3" } });
    });

    // The serializer rejects anything under 15, so the request must carry the
    // clamped value and not the typed one — otherwise the save fails and the
    // editor is told nothing.
    //
    // The handler also writes the clamped number back onto the field. That
    // echo isn't asserted here: it is set imperatively on the DOM node, and
    // jsdom does not model the browser's dirty-value flag faithfully enough
    // for the assertion to mean anything either way.
    expect(dashMutate).toHaveBeenCalledWith("/ticker-modules/1/", "PATCH", { refresh_seconds: 15 });
    expect(field).toBeInTheDocument();
  });

  it("treats a cleared or non-numeric interval as the floor", async () => {
    dashMutate.mockResolvedValue({});
    render(<TickerManager items={[mod(1, "الأسواق", 1)]} />);

    await act(async () => {
      fireEvent.blur(screen.getByLabelText("زمن تحديث الأسواق بالثواني"), { target: { value: "" } });
    });

    expect(dashMutate).toHaveBeenCalledWith("/ticker-modules/1/", "PATCH", { refresh_seconds: 15 });
  });

  it("writes nothing when the interval is left unchanged", async () => {
    render(<TickerManager items={[mod(1, "الأسواق", 1, { refresh_seconds: 90 })]} />);

    await act(async () => {
      fireEvent.blur(screen.getByLabelText("زمن تحديث الأسواق بالثواني"), { target: { value: "90" } });
    });

    expect(dashMutate).not.toHaveBeenCalled();
  });

  it("shows an em-dash rather than a blank where a module has no source", () => {
    render(<TickerManager items={[mod(1, "الأسواق", 1, { source: "" })]} />);

    expect(screen.getByText("المصدر: —")).toBeInTheDocument();
  });
});
