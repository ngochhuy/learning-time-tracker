// @vitest-environment jsdom

import { cleanup, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MatchaAppLoading, type LoadingSection } from "@/components/matcha-app-loading";

afterEach(cleanup);

describe("MatchaAppLoading", () => {
  const routes: Array<[LoadingSection, string]> = [
    ["timer", "Timer"],
    ["dashboard", "Thống kê"],
    ["history", "Lịch sử"],
    ["categories", "Danh mục"],
  ];

  it.each(routes)("shows the right accessible route status for %s", (active, label) => {
    const { container } = render(<MatchaAppLoading active={active} />);

    expect(within(container).getByRole("status").textContent).toContain(label);
    expect(container.firstElementChild?.getAttribute("aria-busy")).toBe("true");
  });
});
