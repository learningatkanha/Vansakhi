import { getCurrentMember } from "@/lib/auth";
import { EMPTY_DOC, todayIST } from "@/lib/journal-doc";
import { EntryForm } from "../entry-form";

export default async function NewEntryPage() {
  await getCurrentMember();
  return (
    <EntryForm
      initial={{
        id: null,
        title: "",
        body: EMPTY_DOC,
        entryDate: todayIST(),
        place: null,
        weather: "",
        tags: "",
        isShared: false,
        observationIds: [],
      }}
    />
  );
}
