import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { AdminPanel, formatAdminDate } from "./AdminPanel"

describe("AdminPanel", () => {
  it("renders the protected login screen when there is no admin session", () => {
    const html = renderToStaticMarkup(<AdminPanel onBack={() => {}} onTestRun={() => {}} />)
    expect(html).toContain("Вход администратора")
    expect(html).toContain("Секретный пароль хранится только на сервере.")
    expect(html).toContain('type="password"')
    expect(html).toContain("В меню")
  })

  it("formats invalid dates without throwing", () => {
    expect(formatAdminDate("not-a-date")).toBe("дата неизвестна")
  })
})
