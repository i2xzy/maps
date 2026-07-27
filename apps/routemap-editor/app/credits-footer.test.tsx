import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { RINT_CATALOG, rintCreditRequired } from "@repo/routemap/rint-catalog";
import { renderWithChakra } from "./test-utils";
import { CreditsFooter } from "./credits-footer";

/** A real catalogued file that does / doesn't oblige a credit. */
const owed = RINT_CATALOG.find((e) => rintCreditRequired(e.file))!.file;
const free = RINT_CATALOG.find((e) => !rintCreditRequired(e.file))!.file;

describe("CreditsFooter", () => {
  it("always says where the images come from", () => {
    renderWithChakra(<CreditsFooter files={[]} />);

    const commons = screen.getByRole("link", { name: /Wikimedia Commons/ });
    expect(commons.getAttribute("href")).toContain("commons.wikimedia.org");
    // Opens off-site, so it must not hand over the referrer.
    expect(commons.getAttribute("rel")).toContain("noreferrer");
  });

  it("offers no credits list when nothing on screen needs crediting", () => {
    renderWithChakra(<CreditsFooter files={[free]} />);

    // Public-domain and CC0 logos are the majority of the catalog. Inviting someone to
    // open an empty list would train them to ignore it.
    expect(screen.queryByRole("button", { name: /Logo credits/ })).toBeNull();
  });

  it("counts the logos that do need crediting", () => {
    renderWithChakra(<CreditsFooter files={[owed, free]} />);

    // One, not two: the attribution-free file is not a credit owed.
    expect(
      screen.getByRole("button", { name: /Logo credits \(1\)/ }),
    ).toBeTruthy();
  });

  it("counts a repeated logo once", () => {
    renderWithChakra(<CreditsFooter files={[owed, owed, owed]} />);

    expect(
      screen.getByRole("button", { name: /Logo credits \(1\)/ }),
    ).toBeTruthy();
  });

  it("survives a file the catalog has never heard of", () => {
    // The safe direction is to credit it, so it counts — the alternative is silently
    // dropping an obligation because a snapshot is stale.
    renderWithChakra(<CreditsFooter files={["Not a real file at all.svg"]} />);

    expect(
      screen.getByRole("button", { name: /Logo credits \(1\)/ }),
    ).toBeTruthy();
  });
});
