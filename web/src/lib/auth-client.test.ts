import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { authRequest } from "./auth-client";
const fetcher = vi.fn();
beforeEach(() => vi.stubGlobal("fetch", fetcher));
afterEach(() => { fetcher.mockReset(); vi.unstubAllGlobals(); });
it("Google 202 asks for a role, without announcing a successful login", async () => {
  fetcher.mockResolvedValue(Response.json({ needs_account_type:true,email:"new@example.test" }, {status:202}));
  expect(await authRequest("google", {credential:"google-token"})).toEqual({ok:false,needsAccountType:true,googleEmail:"new@example.test"});
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("a successful login response without a working session is an error", async () => {
  fetcher.mockResolvedValueOnce(Response.json({token:"token"})).mockResolvedValueOnce(Response.json({error:{message:"нужен вход"}}, {status:401}));
  expect(await authRequest("login", {email:"a@example.test",password:"example"})).toMatchObject({ok:false,error:expect.stringContaining("сессию")});
});
it("a role-selected signup succeeds only when /me confirms the session", async () => {
  fetcher.mockResolvedValueOnce(Response.json({token:"token"})).mockResolvedValueOnce(Response.json({authenticated:true,id:"3"}));
  expect(await authRequest("google", {credential:"google-token",account_type:"section_owner"})).toEqual({ok:true});
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({account_type:"section_owner"});
});
