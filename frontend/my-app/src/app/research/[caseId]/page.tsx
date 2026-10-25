import CaseWorkspace from '../components/CaseWorkspace';

export default async function ResearchCasePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  return <CaseWorkspace key={caseId} caseId={caseId} />;
}
