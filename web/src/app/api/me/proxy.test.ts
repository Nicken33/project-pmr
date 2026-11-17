// @vitest-environment node
import { expect, it } from "vitest";
import { resolveUpstream } from "./[...action]/route";
it("review photos, videos and reports reach the actual backend routes",()=>{
  expect(resolveUpstream(["reviews","15","photos"])).toMatchObject({path:"/api/v1/reviews/15/photos",upload:"photo",methods:["POST"]});
  expect(resolveUpstream(["reviews","15","videos"])).toMatchObject({path:"/api/v1/reviews/15/videos",upload:"video",methods:["POST"]});
  expect(resolveUpstream(["reports"])).toMatchObject({path:"/api/v1/reports",methods:["POST"]});
  expect(resolveUpstream(["reviews","15","media","23"])).toMatchObject({path:"/api/v1/reviews/15/media/23",methods:["DELETE"]});
  expect(resolveUpstream(["reviews","../activities","photos"])).toBeNull();
});
