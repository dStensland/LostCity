import FilmProgramsPage from "../_components/film/FilmProgramsPage";

type Props = {
  params: Promise<{ portal: string }>;
};

export default async function ScreeningProgramsPage({ params }: Props) {
  const { portal } = await params;
  return <FilmProgramsPage portalSlug={portal} />;
}
