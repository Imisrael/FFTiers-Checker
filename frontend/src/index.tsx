import ReactDOM from 'react-dom/client'
import {
    QueryClient,
    QueryClientProvider,
    useQuery,
} from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

const queryClient = new QueryClient();

export default function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <ReactQueryDevtools />
            <Example />
        </QueryClientProvider>
    )
}

function Example() {
    const { isPending, error, data } = useQuery({
        queryKey: ['tiers'],
        queryFn: async () => {
            const response = await fetch('/json')
            const jsonData = await response.json()
            return jsonData;
        },
    })

    if (isPending) return 'Loading...'

    if (error) return 'An error has occurred: ' + error.message


    console.log(data)

        return (
            <div>
                <pre>
                    <code>
                        {JSON.stringify(data, null, 2)}
                    </code>
                </pre>
            </div>
    )

}

const rootElement = document.getElementById('root') as HTMLElement
ReactDOM.createRoot(rootElement).render(<App />)
