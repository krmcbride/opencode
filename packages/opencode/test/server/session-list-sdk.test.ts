import { afterEach, describe, expect, test } from "bun:test"
import { mkdir } from "fs/promises"
import { createOpencodeClient } from "@opencode-ai/sdk/v2"
import { Instance } from "../../src/project/instance"
import { Server } from "../../src/server/server"
import { Session } from "../../src/session"
import { Log } from "../../src/util/log"
import { tmpdir } from "../fixture/fixture"

Log.init({ print: false })

afterEach(async () => {
  await Instance.disposeAll()
})

describe("session.list with sdk directory", () => {
  test("does not implicitly filter by current directory", async () => {
    await using tmp = await tmpdir({ git: true })
    const dir = `${tmp.path}/.dmux/worktrees/a`
    await mkdir(dir, { recursive: true })

    const key = `worktree-${Date.now()}`
    const root = await Instance.provide({
      directory: tmp.path,
      fn: async () => Session.create({ title: `${key}-root` }),
    })
    const child = await Instance.provide({
      directory: dir,
      fn: async () => Session.create({ title: `${key}-child` }),
    })

    const app = Server.Default()
    const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const req = new Request(input, init)
      return app.fetch(req)
    }) as typeof globalThis.fetch

    const sdk = createOpencodeClient({
      baseUrl: "http://opencode.internal",
      directory: dir,
      fetch: fetcher,
    })
    const res = await sdk.session.list({ search: key })
    const ids = (res.data ?? []).map((item) => item.id)

    expect(ids).toContain(root.id)
    expect(ids).toContain(child.id)
  })
})
