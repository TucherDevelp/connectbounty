import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./button";

describe("<Button>", () => {
  it("renders as a button with provided label", () => {
    render(<Button>Klick mich</Button>);
    expect(screen.getByRole("button", { name: "Klick mich" })).toBeInTheDocument();
  });

  it("defaults to type='button' to avoid accidental form submits", () => {
    render(<Button>X</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("calls onClick", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>X</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire onClick when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        X
      </Button>,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("applies size and variant classes", () => {
    render(
      <Button variant="destructive" size="lg">
        Löschen
      </Button>,
    );
    const btn = screen.getByRole("button");
    expect(btn.className).toMatch(/h-12/);
    expect(btn.className).toMatch(/text-white/);
  });
});
