import { randomUUID } from "node:crypto";
import { jwt } from "@elysiajs/jwt";
import { Elysia, t } from "elysia";
import { BaseHtml } from "../components/base";
import { Header } from "../components/header";
import db from "../db/db";
import { User } from "../db/types";
import {
  ACCOUNT_REGISTRATION,
  ALLOW_UNAUTHENTICATED,
  HIDE_HISTORY,
  HTTP_ALLOWED,
  WEBROOT,
} from "../helpers/env";

export let FIRST_RUN = db.query("SELECT * FROM users").get() === null || false;

function normalizeUsername(username: string | null | undefined) {
  return username?.trim() ?? "";
}

function isAdmin(user: User | null | undefined) {
  return user?.is_admin === 1;
}

export const userService = new Elysia({ name: "user/service" })
  .use(
    jwt({
      name: "jwt",
      schema: t.Object({
        id: t.String(),
      }),
      secret: process.env.JWT_SECRET ?? randomUUID(),
      exp: "7d",
    }),
  )
  .model({
    signIn: t.Object({
      username: t.String(),
      password: t.String(),
    }),
    session: t.Cookie({
      auth: t.String(),
      jobId: t.Optional(t.String()),
    }),
    optionalSession: t.Cookie({
      auth: t.Optional(t.String()),
      jobId: t.Optional(t.String()),
    }),
  })
  .macro("auth", {
    cookie: "session",
    async resolve({ status, jwt, cookie: { auth } }) {
      if (!auth.value) {
        return status(401, {
          success: false,
          message: "未授权",
        });
      }
      const user = await jwt.verify(auth.value);
      if (!user) {
        return status(401, {
          success: false,
          message: "未授权",
        });
      }
      return {
        success: true,
        user,
      };
    },
  });

export const user = new Elysia()
  .use(userService)
  .get("/setup", ({ redirect }) => {
    if (!FIRST_RUN) {
      return redirect(`${WEBROOT}/login`, 302);
    }

    return (
      <BaseHtml title="ConvertX-extend | 初始化" webroot={WEBROOT}>
        <main
          class={`
            mx-auto w-full max-w-4xl flex-1 px-2
            sm:px-4
          `}
        >
          <h1 class="my-8 text-3xl">欢迎使用 ConvertX-extend！</h1>
          <article class="article p-0">
            <header class="w-full bg-neutral-800 p-4">创建你的账户</header>
            <form method="post" action={`${WEBROOT}/register`} class="p-4">
              <fieldset class="mb-4 flex flex-col gap-4">
                <label class="flex flex-col gap-1">
                  用户名
                  <input
                    type="text"
                    name="username"
                    class="rounded-sm bg-neutral-800 p-3"
                    placeholder="用户名"
                    autocomplete="username"
                    required
                  />
                </label>
                <label class="flex flex-col gap-1">
                  密码
                  <input
                    type="password"
                    name="password"
                    class="rounded-sm bg-neutral-800 p-3"
                    placeholder="密码"
                    autocomplete="current-password"
                    required
                  />
                </label>
              </fieldset>
              <input type="submit" value="创建账户" class="btn-primary" />
            </form>
            <footer class="p-4">如有问题，请到当前项目仓库反馈。</footer>
          </article>
        </main>
      </BaseHtml>
    );
  })
  .get("/register", ({ redirect }) => {
    if (!ACCOUNT_REGISTRATION) {
      return redirect(`${WEBROOT}/login`, 302);
    }

    return (
      <BaseHtml webroot={WEBROOT} title="ConvertX-extend | 注册">
        <>
          <Header
            webroot={WEBROOT}
            accountRegistration={ACCOUNT_REGISTRATION}
            allowUnauthenticated={ALLOW_UNAUTHENTICATED}
            hideHistory={HIDE_HISTORY}
          />
          <main
            class={`
              w-full flex-1 px-2
              sm:px-4
            `}
          >
            <article class="article">
              <form method="post" class="flex flex-col gap-4">
                <fieldset class="mb-4 flex flex-col gap-4">
                  <label class="flex flex-col gap-1">
                    用户名
                    <input
                      type="text"
                      name="username"
                      class="rounded-sm bg-neutral-800 p-3"
                      placeholder="用户名"
                      autocomplete="username"
                      required
                    />
                  </label>
                  <label class="flex flex-col gap-1">
                    密码
                    <input
                      type="password"
                      name="password"
                      class="rounded-sm bg-neutral-800 p-3"
                      placeholder="密码"
                      autocomplete="current-password"
                      required
                    />
                  </label>
                </fieldset>
                <input type="submit" value="注册" class="w-full btn-primary" />
              </form>
            </article>
          </main>
        </>
      </BaseHtml>
    );
  })
  .post(
    "/register",
    async ({ body: { username, password }, set, redirect, jwt, cookie: { auth } }) => {
      const normalizedUsername = normalizeUsername(username);
      if (!ACCOUNT_REGISTRATION && !FIRST_RUN) {
        return redirect(`${WEBROOT}/login`, 302);
      }

      if (!normalizedUsername) {
        set.status = 400;
        return {
          message: "用户名不能为空。",
        };
      }

      const shouldCreateAdmin = FIRST_RUN;
      if (FIRST_RUN) {
        FIRST_RUN = false;
      }

      const existingUser = await db
        .query("SELECT * FROM users WHERE username = ?")
        .get(normalizedUsername);
      if (existingUser) {
        set.status = 400;
        return {
          message: "用户名已被使用。",
        };
      }
      const savedPassword = await Bun.password.hash(password);

      db.query("INSERT INTO users (username, password, is_admin) VALUES (?, ?, ?)").run(
        normalizedUsername,
        savedPassword,
        shouldCreateAdmin ? 1 : 0,
      );

      const user = db
        .query("SELECT * FROM users WHERE username = ?")
        .as(User)
        .get(normalizedUsername);

      if (!user) {
        set.status = 500;
        return {
          message: "创建用户失败。",
        };
      }

      const accessToken = await jwt.sign({
        id: String(user.id),
      });

      if (!auth) {
        set.status = 500;
        return {
          message: "没有认证 Cookie，可能是浏览器阻止了 Cookie。",
        };
      }

      // set cookie
      auth.set({
        value: accessToken,
        httpOnly: true,
        secure: !HTTP_ALLOWED,
        maxAge: 60 * 60 * 24 * 7,
        sameSite: "strict",
      });

      return redirect(`${WEBROOT}/`, 302);
    },
    { body: "signIn" },
  )
  .get(
    "/login",
    async ({ jwt, redirect, cookie: { auth } }) => {
      if (FIRST_RUN) {
        return redirect(`${WEBROOT}/setup`, 302);
      }

      // if already logged in, redirect to home
      if (auth?.value) {
        const user = await jwt.verify(auth.value);

        if (user) {
          return redirect(`${WEBROOT}/`, 302);
        }

        auth.remove();
      }

      return (
        <BaseHtml webroot={WEBROOT} title="ConvertX-extend | 登录">
          <>
            <Header
              webroot={WEBROOT}
              accountRegistration={ACCOUNT_REGISTRATION}
              allowUnauthenticated={ALLOW_UNAUTHENTICATED}
              hideHistory={HIDE_HISTORY}
            />
            <main
              class={`
                w-full flex-1 px-2
                sm:px-4
              `}
            >
              <article class="article">
                <form method="post" class="flex flex-col gap-4">
                  <fieldset class="mb-4 flex flex-col gap-4">
                    <label class="flex flex-col gap-1">
                      用户名
                      <input
                        type="text"
                        name="username"
                        class="rounded-sm bg-neutral-800 p-3"
                        placeholder="用户名"
                        autocomplete="username"
                        required
                      />
                    </label>
                    <label class="flex flex-col gap-1">
                      密码
                      <input
                        type="password"
                        name="password"
                        class="rounded-sm bg-neutral-800 p-3"
                        placeholder="密码"
                        autocomplete="current-password"
                        required
                      />
                    </label>
                  </fieldset>
                  <div class="flex flex-row gap-4">
                    {ACCOUNT_REGISTRATION ? (
                      <a
                        href={`${WEBROOT}/register`}
                        role="button"
                        class="w-full btn-secondary text-center"
                      >
                        注册
                      </a>
                    ) : null}
                    <input type="submit" value="登录" class="w-full btn-primary" />
                  </div>
                </form>
              </article>
            </main>
          </>
        </BaseHtml>
      );
    },
    { body: "signIn", cookie: "optionalSession" },
  )
  .post(
    "/login",
    async function handler({ body, set, redirect, jwt, cookie: { auth } }) {
      const username = normalizeUsername(body.username);
      const existingUser = db
        .query("SELECT * FROM users WHERE username = ?")
        .as(User)
        .get(username);

      if (!existingUser) {
        set.status = 403;
        return {
          message: "用户名或密码不正确。",
        };
      }

      const validPassword = await Bun.password.verify(body.password, existingUser.password);

      if (!validPassword) {
        set.status = 403;
        return {
          message: "用户名或密码不正确。",
        };
      }

      const accessToken = await jwt.sign({
        id: String(existingUser.id),
      });

      if (!auth) {
        set.status = 500;
        return {
          message: "没有认证 Cookie，可能是浏览器阻止了 Cookie。",
        };
      }

      // set cookie
      auth.set({
        value: accessToken,
        httpOnly: true,
        secure: !HTTP_ALLOWED,
        maxAge: 60 * 60 * 24 * 7,
        sameSite: "strict",
      });

      return redirect(`${WEBROOT}/`, 302);
    },
    { body: "signIn" },
  )
  .get("/logoff", ({ redirect, cookie: { auth } }) => {
    if (auth?.value) {
      auth.remove();
    }

    return redirect(`${WEBROOT}/login`, 302);
  })
  .post("/logoff", ({ redirect, cookie: { auth } }) => {
    if (auth?.value) {
      auth.remove();
    }

    return redirect(`${WEBROOT}/login`, 302);
  })
  .get(
    "/account",
    async ({ user, redirect }) => {
      if (!user) {
        return redirect(`${WEBROOT}/`, 302);
      }

      const userData = db.query("SELECT * FROM users WHERE id = ?").as(User).get(user.id);

      if (!userData) {
        return redirect(`${WEBROOT}/`, 302);
      }

      const users = isAdmin(userData)
        ? (db
            .query("SELECT id, username, is_admin FROM users ORDER BY id")
            .as(User)
            .all() as User[])
        : [];

      return (
        <BaseHtml webroot={WEBROOT} title="ConvertX-extend | 账户">
          <>
            <Header
              webroot={WEBROOT}
              accountRegistration={ACCOUNT_REGISTRATION}
              allowUnauthenticated={ALLOW_UNAUTHENTICATED}
              hideHistory={HIDE_HISTORY}
              loggedIn
            />
            <main
              class={`
                w-full flex-1 px-2
                sm:px-4
              `}
            >
              <article class="article">
                <h1 class="mb-4 text-xl">账户设置</h1>
                <form method="post" class="flex flex-col gap-4">
                  <fieldset class="mb-4 flex flex-col gap-4">
                    <label class="flex flex-col gap-1">
                      用户名
                      <input
                        type="text"
                        name="username"
                        class="rounded-sm bg-neutral-800 p-3"
                        placeholder="用户名"
                        autocomplete="username"
                        value={userData.username}
                        required
                      />
                    </label>
                    <label class="flex flex-col gap-1">
                      新密码（留空则不修改）
                      <input
                        type="password"
                        name="newPassword"
                        class="rounded-sm bg-neutral-800 p-3"
                        placeholder="密码"
                        autocomplete="new-password"
                      />
                    </label>
                    <label class="flex flex-col gap-1">
                      当前密码
                      <input
                        type="password"
                        name="password"
                        class="rounded-sm bg-neutral-800 p-3"
                        placeholder="密码"
                        autocomplete="current-password"
                        required
                      />
                    </label>
                  </fieldset>
                  <div role="group">
                    <input type="submit" value="更新" class="w-full btn-primary" />
                  </div>
                </form>
              </article>
              {isAdmin(userData) ? (
                <article class="article mt-4">
                  <h2 class="mb-4 text-xl">用户管理</h2>
                  <form
                    method="post"
                    action={`${WEBROOT}/admin/users`}
                    class="mb-6 flex flex-col gap-4"
                  >
                    <fieldset class="grid gap-4 sm:grid-cols-2">
                      <label class="flex flex-col gap-1">
                        用户名
                        <input
                          type="text"
                          name="username"
                          class="rounded-sm bg-neutral-800 p-3"
                          placeholder="用户名"
                          autocomplete="off"
                          required
                        />
                      </label>
                      <label class="flex flex-col gap-1">
                        密码
                        <input
                          type="password"
                          name="password"
                          class="rounded-sm bg-neutral-800 p-3"
                          placeholder="密码"
                          autocomplete="new-password"
                          required
                        />
                      </label>
                    </fieldset>
                    <label class="flex items-center gap-2">
                      <input type="checkbox" name="is_admin" value="1" class="size-4" />
                      设为管理员
                    </label>
                    <div>
                      <input type="submit" value="新建用户" class="btn-primary" />
                    </div>
                  </form>
                  <div class="overflow-x-auto">
                    <table>
                      <thead>
                        <tr>
                          <th class="p-2 text-left">ID</th>
                          <th class="p-2 text-left">用户名</th>
                          <th class="p-2 text-left">角色</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((managedUser) => (
                          <tr>
                            <td class="p-2" safe>
                              {managedUser.id}
                            </td>
                            <td class="p-2" safe>
                              {managedUser.username}
                            </td>
                            <td class="p-2" safe>
                              {isAdmin(managedUser) ? "管理员" : "普通用户"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
              ) : null}
            </main>
          </>
        </BaseHtml>
      );
    },
    {
      auth: true,
    },
  )
  .post(
    "/account",
    async function handler({ body, set, redirect, jwt, cookie: { auth } }) {
      if (!auth?.value) {
        return redirect(`${WEBROOT}/login`, 302);
      }

      const user = await jwt.verify(auth.value);
      if (!user) {
        return redirect(`${WEBROOT}/login`, 302);
      }
      const existingUser = db.query("SELECT * FROM users WHERE id = ?").as(User).get(user.id);

      if (!existingUser) {
        if (auth?.value) {
          auth.remove();
        }
        return redirect(`${WEBROOT}/login`, 302);
      }

      const validPassword = await Bun.password.verify(body.password, existingUser.password);

      if (!validPassword) {
        set.status = 403;
        return {
          message: "用户名或密码不正确。",
        };
      }

      const fields = [];
      const values = [];
      const username = normalizeUsername(body.username);

      if (username) {
        const existingUser = await db
          .query("SELECT id FROM users WHERE username = ?")
          .as(User)
          .get(username);
        if (existingUser && existingUser.id.toString() !== user.id) {
          set.status = 409;
          return { message: "用户名已被使用。" };
        }
        fields.push("username");
        values.push(username);
      }
      if (body.newPassword) {
        fields.push("password");
        values.push(await Bun.password.hash(body.newPassword));
      }

      if (fields.length > 0) {
        db.query(
          `UPDATE users SET ${fields.map((field) => `${field}=?`).join(", ")} WHERE id=?`,
        ).run(...values, user.id);
      }

      return redirect(`${WEBROOT}/`, 302);
    },
    {
      body: t.Object({
        username: t.MaybeEmpty(t.String()),
        newPassword: t.MaybeEmpty(t.String()),
        password: t.String(),
      }),
      cookie: "session",
    },
  )
  .post(
    "/admin/users",
    async function handler({ body, set, redirect, jwt, cookie: { auth } }) {
      if (!auth?.value) {
        return redirect(`${WEBROOT}/login`, 302);
      }

      const sessionUser = await jwt.verify(auth.value);
      if (!sessionUser) {
        return redirect(`${WEBROOT}/login`, 302);
      }

      const currentUser = db.query("SELECT * FROM users WHERE id = ?").as(User).get(sessionUser.id);
      if (!isAdmin(currentUser)) {
        set.status = 403;
        return {
          message: "需要管理员权限。",
        };
      }

      const username = normalizeUsername(body.username);
      if (!username) {
        set.status = 400;
        return {
          message: "用户名不能为空。",
        };
      }

      const existingUser = db.query("SELECT id FROM users WHERE username = ?").get(username);
      if (existingUser) {
        set.status = 409;
        return {
          message: "用户名已被使用。",
        };
      }

      const savedPassword = await Bun.password.hash(body.password);
      db.query("INSERT INTO users (username, password, is_admin) VALUES (?, ?, ?)").run(
        username,
        savedPassword,
        body.is_admin === "1" ? 1 : 0,
      );

      return redirect(`${WEBROOT}/account`, 302);
    },
    {
      body: t.Object({
        username: t.String(),
        password: t.String(),
        is_admin: t.Optional(t.String()),
      }),
      cookie: "session",
    },
  );
