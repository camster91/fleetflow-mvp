import Layout from '../components/Layout';

export default function RoutesPage() {
  return (
    <Layout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Route Optimization</h1>
        <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 flex flex-col items-center justify-center text-center">
          <div className="text-gray-400 mb-4">📍</div>
          <h2 className="text-lg font-medium text-gray-900 mb-2">AI Routing Coming Soon</h2>
          <p className="text-gray-500 max-w-md">
            We are integrating advanced AI route optimization to save you fuel and time. Check back soon for the v1 release.
          </p>
        </div>
      </div>
    </Layout>
  );
}
