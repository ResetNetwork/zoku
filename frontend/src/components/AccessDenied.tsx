// Access Denied page for observed tier users
export default function AccessDenied() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg text-center">
        <div className="mb-6">
          <svg
            className="mx-auto h-16 w-16 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Access Denied
        </h1>

        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Your account exists in the system but has not been granted access.
          Contact a system administrator to request access.
        </p>

        <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded mb-6">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            <strong>Email:</strong> admin@reset.tech
          </p>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400">
          Your account tier: <span className="font-mono bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">observed</span>
        </p>
      </div>
    </div>
  );
}
