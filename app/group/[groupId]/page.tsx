import { redirect } from "next/navigation";
import { isGroupId } from "../../../lib/groups";
import GroupApp from "../../group-app";

export default async function GroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  if (!isGroupId(groupId)) redirect("/");
  return <GroupApp key={groupId} groupId={groupId}/>;
}
