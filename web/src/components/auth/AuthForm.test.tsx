import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({google:vi.fn(),login:vi.fn(),register:vi.fn(),trigger:vi.fn(),push:vi.fn(),refresh:vi.fn(),verify:vi.fn(),options:null as unknown}));
vi.mock("next/navigation",()=>({useRouter:()=>({push:mocks.push,refresh:mocks.refresh})}));
vi.mock("@react-oauth/google",()=>({useGoogleOAuth:()=>({scriptLoadedSuccessfully:true}),useGoogleLogin:(options:unknown)=>{mocks.options=options;return mocks.trigger;}}));
vi.mock("@/components/providers/AppProviders",()=>({useApp:()=>({user:null,loginWithGoogle:mocks.google,loginWithEmail:mocks.login,registerWithEmail:mocks.register})}));
vi.mock("@/lib/auth-client",()=>({verifyAuthSession:mocks.verify}));
import { AuthForm } from "./AuthForm";
type GoogleOptions={onSuccess:(value:{access_token:string})=>Promise<void>;onNonOAuthError:(value:{type:string})=>void};
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID","client-id");});
afterEach(()=>{cleanup();vi.unstubAllEnvs();});
async function openGoogleSignup(){
  mocks.google.mockResolvedValueOnce({ok:false,needsAccountType:true,googleEmail:"new@example.test"});
  render(<AuthForm next="/" intent="register"/>);
  fireEvent.click(screen.getByRole("button",{name:"Google"}));
  await act(async()=>{await (mocks.options as GoogleOptions).onSuccess({access_token:"access-token"});});
}
it("shows one role picker and hides the password form during Google signup",async()=>{
  await openGoogleSignup();
  expect(screen.getAllByRole("radiogroup")).toHaveLength(1);
  expect(screen.queryByLabelText("Пароль",{exact:true})).toBeNull();
  expect(screen.queryByRole("button",{name:"Google"})).toBeNull();
  expect(screen.getByText("Завершить регистрацию через Google")).toBeInTheDocument();
});
it("sends the selected Google role once even after repeated clicks",async()=>{
  await openGoogleSignup();
  mocks.google.mockImplementation(()=>new Promise(()=>{}));
  fireEvent.click(screen.getByRole("radio",{name:/Организация/}));
  const button=screen.getByRole("button",{name:"Продолжить и создать аккаунт"});
  fireEvent.click(button);fireEvent.click(button);
  expect(mocks.google).toHaveBeenCalledTimes(2);
  expect(mocks.google).toHaveBeenLastCalledWith("access-token","section_owner");
});
it("recovers session verification without posting another registration",async()=>{
  await openGoogleSignup();
  mocks.google.mockResolvedValueOnce({ok:false,sessionUnconfirmed:true,error:"Сессия пока не подтверждена"});
  fireEvent.click(screen.getByRole("button",{name:"Продолжить и создать аккаунт"}));
  const retry=await screen.findByRole("button",{name:"Проверить вход"});
  expect(screen.queryByRole("button",{name:"Продолжить и создать аккаунт"})).toBeNull();
  mocks.verify.mockResolvedValueOnce({ok:true});
  fireEvent.click(retry);
  await waitFor(()=>expect(mocks.refresh).toHaveBeenCalled());
  expect(mocks.google).toHaveBeenCalledTimes(2);
  expect(mocks.register).not.toHaveBeenCalled();
});
it("releases the Google button if the popup is closed",async()=>{
  render(<AuthForm next="/" intent="login"/>);
  const button=screen.getByRole("button",{name:"Google"});
  fireEvent.click(button);
  expect(button).toBeDisabled();
  act(()=>(mocks.options as GoogleOptions).onNonOAuthError({type:"popup_closed"}));
  expect(button).toBeEnabled();
});

it("email login remains usable when Google client ID is not configured",()=>{
  vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID","");
  render(<AuthForm next="/" intent="login"/>);
  expect(screen.getByLabelText("Пароль",{exact:true})).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:"Google"}));
  expect(screen.getByRole("alert")).toHaveTextContent("не задан NEXT_PUBLIC_GOOGLE_CLIENT_ID");
  expect(mocks.trigger).not.toHaveBeenCalled();
});
