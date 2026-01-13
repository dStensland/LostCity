import Link from "next/link";

export default function PortalNotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Portal Not Found
        </h1>
        <p className="text-gray-600 mb-8">
          This portal doesn&apos;t exist or isn&apos;t active yet.
        </p>
        <Link
          href="https://lostcity.ai"
          className="inline-flex items-center px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800"
        >
          Go to Lost City
        </Link>
      </div>
    </div>
  );
}
