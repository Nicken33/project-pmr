import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/api", () => ({apiBaseUrl:()=>"https://api.example.test",getClientAuthToken:async()=>"session-token"}));
import { createReview, listReviews, reportContent, reviewFromRecord, uploadReviewFile } from "./community-api";
const fetcher=vi.fn();
beforeEach(()=>vi.stubGlobal("fetch",fetcher));
afterEach(()=>{fetcher.mockReset();vi.unstubAllGlobals();});
it("reviews are read with persisted media IDs and file URLs",async()=>{
  const row={id:"15",author_id:"6",author_name:"Матвей",text:"Отзыв",created_at:"2026-11-17T10:00:00Z",photos:[{id:"12",path:"reviews/15/a.jpg"}],videos:[{id:"13",path:"/media/reviews/15/a.mp4"}]};
  fetcher.mockResolvedValue(Response.json({items:[row],total:1,page:1,limit:20}));
  const page=await listReviews("7");
  expect(reviewFromRecord(page.items[0]).media).toEqual([{id:"12",url:"/media/reviews/15/a.jpg",kind:"photo"},{id:"13",url:"/media/reviews/15/a.mp4",kind:"video"}]);
});
it("own-review rejection is surfaced, rather than a local fake success",async()=>{
  fetcher.mockResolvedValue(Response.json({error:{code:"cannot_review_own_activity",message:"Нельзя писать отзыв на свою секцию"}},{status:403}));
  await expect(createReview("7","Текст")).rejects.toMatchObject({status:403,message:expect.stringContaining("Нельзя")});
});
it("a selected file is uploaded as multipart attached to the created review ID",async()=>{
  fetcher.mockResolvedValue(Response.json({id:"23",path:"/media/reviews/15/a.jpg"},{status:201}));
  const file=new File(["image"],"a.jpg",{type:"image/jpeg"});
  await uploadReviewFile("15",file,"photo");
  expect(fetcher.mock.calls[0][0]).toBe("/api/me/reviews/15/photos");
  expect((fetcher.mock.calls[0][1].body as FormData).get("file")).toBe(file);
});
it("large photos bypass the hosting body limit and reach the backend with auth",async()=>{
  fetcher.mockResolvedValue(Response.json({id:"24",path:"/media/reviews/15/b.jpg"},{status:201}));
  await uploadReviewFile("15",new File([new Uint8Array(5*1024*1024)],"b.jpg",{type:"image/jpeg"}),"photo");
  expect(fetcher.mock.calls[0][0]).toBe("https://api.example.test/api/v1/reviews/15/photos");
  expect(fetcher.mock.calls[0][1].headers.authorization).toBe("Bearer session-token");
});
it("reports use numeric string target IDs and the actual backend field names",async()=>{
  fetcher.mockResolvedValue(Response.json({id:"1"},{status:201}));
  await reportContent("media","24","Личные данные","Пояснение");
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({target_type:"media",target_id:"24",reason:"Личные данные",detail:"Пояснение"});
});
