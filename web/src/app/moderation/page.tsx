import type { Metadata } from "next";
import { ModerationClient } from "@/components/moderation/ModerationClient";
import {
  applications,
  blockings,
  contentReports,
  gapRequests,
  moderationJournal,
  searchGaps,
} from "@/lib/data";

export const metadata: Metadata = {
  title: "Модерация — Talentro",
  description:
    "Очередь анкет на проверке, жалобы на отзывы и медиа, журнал решений и дефициты каталога.",
};

export const dynamic = "force-dynamic";

export default function ModerationPage() {
  return (
    <ModerationClient
      applications={applications}
      journal={moderationJournal}
      reports={contentReports}
      gapRequests={gapRequests}
      searchGaps={searchGaps}
      blockings={blockings}
    />
  );
}
