import { Button } from '@/components/ui/button';
import { Home, ArrowLeft, Search } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-6 text-center">
        <div className="mb-8">
          <h1 className="text-9xl font-bold text-gray-200">404</h1>
          <h2 className="mt-4 text-2xl font-semibold text-gray-900">
            Page not found
          </h2>
          <p className="mt-2 text-gray-600">
            Sorry, we couldn't find the page you're looking for.
          </p>
        </div>

        <div className="space-y-3">
          <Link href="/" className="block">
            <Button className="w-full">
              <Home className="w-4 h-4 mr-2" />
              Go to homepage
            </Button>
          </Link>
          
          <Link href="/dashboard" className="block">
            <Button variant="outline" className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to dashboard
            </Button>
          </Link>
          
          <Link href="/contacts" className="block">
            <Button variant="ghost" className="w-full">
              <Search className="w-4 h-4 mr-2" />
              Search contacts
            </Button>
          </Link>
        </div>

        <p className="mt-8 text-sm text-gray-500">
          If you believe this is a mistake, please{' '}
          <Link href="/support" className="text-blue-600 hover:underline">
            contact support
          </Link>
          .
        </p>
      </div>
    </div>
  );
}