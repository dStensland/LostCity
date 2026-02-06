import LogoShowcase from "@/components/LogoPrototypes";

export default function LogoConceptsPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-2">Logo Concepts</h1>
        <p className="text-gray-500 text-center mb-12 text-sm">
          Exploring new directions for the Lost City brand
        </p>

        <LogoShowcase />

        <div className="mt-16 text-center text-gray-600 text-xs">
          <p>Click/hover on each concept to see animations</p>
        </div>
      </div>
    </div>
  );
}
