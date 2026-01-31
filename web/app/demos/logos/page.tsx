import {
  FamilyCompassLogo,
  BloomingATLLogo,
  NeighborhoodStackLogo,
  FamilyConstellationLogo,
  PortalLogo,
} from "@/components/logos";

export default function LogoDemoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 p-8">
      <div className="max-w-6xl mx-auto space-y-12">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-gray-900">
            Atlanta Families Portal Logos
          </h1>
          <p className="text-lg text-gray-600">
            Four concepts for the Atlanta Families brand identity
          </p>
        </div>

        {/* Family Compass */}
        <section className="bg-white rounded-2xl shadow-lg p-8 space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900">
              1. Family Compass
            </h2>
            <p className="text-gray-600">
              A circular mark with 8 radial divisions, featuring an inner &ldquo;A&rdquo; that doubles as a tent/house/roof shape.
              The slow rotation and sequential dot pulsing evoke exploration and guidance.
            </p>
          </div>
          <div className="flex items-center gap-8 flex-wrap">
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-500">Animated (64px)</p>
              <div className="bg-gray-50 rounded-lg p-6 inline-block">
                <FamilyCompassLogo size={64} animated={true} />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-500">Animated (96px)</p>
              <div className="bg-gray-50 rounded-lg p-6 inline-block">
                <FamilyCompassLogo size={96} animated={true} />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-500">Static (64px)</p>
              <div className="bg-gray-50 rounded-lg p-6 inline-block">
                <FamilyCompassLogo size={64} animated={false} />
              </div>
            </div>
          </div>
        </section>

        {/* Blooming ATL */}
        <section className="bg-white rounded-2xl shadow-lg p-8 space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900">
              2. Blooming ATL
            </h2>
            <p className="text-gray-600">
              An AF monogram where the &ldquo;A&rdquo; is formed by 3 leaf/petal shapes and the &ldquo;F&rdquo; crossbar becomes a curved branch.
              Hover to see the buds bloom. Represents growth and nurturing.
            </p>
          </div>
          <div className="flex items-center gap-8 flex-wrap">
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-500">Animated (64px) - Hover me!</p>
              <div className="bg-gray-50 rounded-lg p-6 inline-block">
                <BloomingATLLogo size={64} animated={true} />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-500">Animated (96px) - Hover me!</p>
              <div className="bg-gray-50 rounded-lg p-6 inline-block">
                <BloomingATLLogo size={96} animated={true} />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-500">Static (64px)</p>
              <div className="bg-gray-50 rounded-lg p-6 inline-block">
                <BloomingATLLogo size={64} animated={false} />
              </div>
            </div>
          </div>
        </section>

        {/* Neighborhood Stack */}
        <section className="bg-white rounded-2xl shadow-lg p-8 space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900">
              3. Neighborhood Stack
            </h2>
            <p className="text-gray-600">
              Playful building-block aesthetic with 4 rounded rectangles in offset arrangement.
              The gentle sliding and restacking animation evokes community and connection.
            </p>
          </div>
          <div className="flex items-center gap-8 flex-wrap">
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-500">Animated (64px)</p>
              <div className="bg-gray-50 rounded-lg p-6 inline-block">
                <NeighborhoodStackLogo size={64} animated={true} />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-500">Animated (96px)</p>
              <div className="bg-gray-50 rounded-lg p-6 inline-block">
                <NeighborhoodStackLogo size={96} animated={true} />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-500">Static (64px)</p>
              <div className="bg-gray-50 rounded-lg p-6 inline-block">
                <NeighborhoodStackLogo size={64} animated={false} />
              </div>
            </div>
          </div>
        </section>

        {/* Family Constellation */}
        <section className="bg-white rounded-2xl shadow-lg p-8 space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900">
              4. Family Constellation
            </h2>
            <p className="text-gray-600">
              5 connected dots forming a constellation (2 larger for parents, 3 smaller for kids).
              Lines draw in on load and dots pulse gently. Represents connection and togetherness.
            </p>
          </div>
          <div className="flex items-center gap-8 flex-wrap">
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-500">Animated (64px)</p>
              <div className="bg-gray-50 rounded-lg p-6 inline-block">
                <FamilyConstellationLogo size={64} animated={true} />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-500">Animated (96px)</p>
              <div className="bg-gray-50 rounded-lg p-6 inline-block">
                <FamilyConstellationLogo size={96} animated={true} />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-500">Static (64px)</p>
              <div className="bg-gray-50 rounded-lg p-6 inline-block">
                <FamilyConstellationLogo size={64} animated={false} />
              </div>
            </div>
          </div>
        </section>

        {/* Portal Logo Component */}
        <section className="bg-white rounded-2xl shadow-lg p-8 space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900">
              PortalLogo Component
            </h2>
            <p className="text-gray-600">
              Dynamic component that selects the appropriate logo based on portal configuration.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="space-y-2 text-center">
              <div className="bg-gray-50 rounded-lg p-6 inline-block">
                <PortalLogo variant="compass" size={80} />
              </div>
              <p className="text-sm font-medium text-gray-700">Compass</p>
            </div>
            <div className="space-y-2 text-center">
              <div className="bg-gray-50 rounded-lg p-6 inline-block">
                <PortalLogo variant="blooming" size={80} />
              </div>
              <p className="text-sm font-medium text-gray-700">Blooming</p>
            </div>
            <div className="space-y-2 text-center">
              <div className="bg-gray-50 rounded-lg p-6 inline-block">
                <PortalLogo variant="stack" size={80} />
              </div>
              <p className="text-sm font-medium text-gray-700">Stack</p>
            </div>
            <div className="space-y-2 text-center">
              <div className="bg-gray-50 rounded-lg p-6 inline-block">
                <PortalLogo variant="constellation" size={80} />
              </div>
              <p className="text-sm font-medium text-gray-700">Constellation</p>
            </div>
          </div>
        </section>

        {/* Usage Example */}
        <section className="bg-gray-900 text-white rounded-2xl shadow-lg p-8 space-y-6">
          <h2 className="text-2xl font-bold">Usage Example</h2>
          <div className="bg-gray-800 rounded-lg p-6 overflow-x-auto">
            <pre className="text-sm">
              <code>{`import { PortalLogo } from "@/components/logos";

// In your portal header
<PortalLogo
  variant="compass"
  size={48}
  animated={true}
  className="hover:scale-110 transition-transform"
/>

// Individual logos
import {
  FamilyCompassLogo,
  BloomingATLLogo,
  NeighborhoodStackLogo,
  FamilyConstellationLogo
} from "@/components/logos";

<FamilyCompassLogo size={64} animated={true} />
<BloomingATLLogo size={64} animated={false} />
`}</code>
            </pre>
          </div>
        </section>

        {/* Dark Background Test */}
        <section className="bg-gradient-to-br from-emerald-900 to-teal-900 rounded-2xl shadow-lg p-8 space-y-6">
          <h2 className="text-2xl font-bold text-white">
            Dark Background Test
          </h2>
          <p className="text-emerald-100">
            All logos should be visible and attractive on dark backgrounds.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="bg-emerald-950/30 rounded-lg p-6 flex items-center justify-center">
              <FamilyCompassLogo size={72} />
            </div>
            <div className="bg-emerald-950/30 rounded-lg p-6 flex items-center justify-center">
              <BloomingATLLogo size={72} />
            </div>
            <div className="bg-emerald-950/30 rounded-lg p-6 flex items-center justify-center">
              <NeighborhoodStackLogo size={72} />
            </div>
            <div className="bg-emerald-950/30 rounded-lg p-6 flex items-center justify-center">
              <FamilyConstellationLogo size={72} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
