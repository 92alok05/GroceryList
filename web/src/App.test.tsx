import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

async function freshApp() {
  vi.resetModules()
  const { App } = await import('./App')
  return render(<App />)
}

const signIn = () => {
  localStorage.setItem('syncDeviceToken', 'tok')
  localStorage.setItem('syncHouseholdName', 'The Joshis')
}

beforeEach(() => {
  localStorage.clear()
  signIn()
  window.location.hash = ''
})
afterEach(() => {
  cleanup()
  vi.doUnmock('./config')
  vi.unstubAllGlobals()
})

describe('onboarding workflow', () => {
  it('shows once, can be skipped, and is replayable from Settings', async () => {
    await freshApp()
    expect(screen.getByRole('dialog', { name: 'Tutorial' })).toBeInTheDocument()
    fireEvent.click(screen.getByText('Skip'))
    expect(screen.queryByRole('dialog', { name: 'Tutorial' })).toBeNull()
    expect(localStorage.getItem('hasSeenOnboardingTutorial')).toBe('true')

    cleanup()
    await freshApp()
    expect(screen.queryByRole('dialog', { name: 'Tutorial' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Settings/ }))
    fireEvent.click(await screen.findByText('Replay Tutorial'))
    expect(screen.getByRole('dialog', { name: 'Tutorial' })).toBeInTheDocument()
  })
})

describe('item workflows', () => {
  beforeEach(() => localStorage.setItem('hasSeenOnboardingTutorial', 'true'))

  it('shows the empty state, adds an item, toggles it and searches', async () => {
    await freshApp()
    expect(screen.getByText('No Items Yet')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Add Item' }))
    const sheet = screen.getByRole('dialog', { name: 'Add Item' })
    expect(within(sheet).getByText('Save')).toBeDisabled()
    fireEvent.change(within(sheet).getByLabelText('Item name'), { target: { value: 'Eggs' } })
    fireEvent.change(within(sheet).getByLabelText('Recommended quantity'), { target: { value: '18' } })
    fireEvent.change(within(sheet).getByLabelText('Cadence'), { target: { value: 'Weekly' } })
    fireEvent.click(within(sheet).getByText('Save'))

    expect(screen.getByText('Eggs')).toBeInTheDocument()
    expect(screen.getByText('Safeway • Qty: 18 • Weekly')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Needed' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Mark Eggs bought' }))
    expect(screen.getByRole('img', { name: 'Bought' })).toBeInTheDocument()
    expect(screen.getByText('Eggs')).toHaveClass('struck')
    const stored = JSON.parse(localStorage.getItem('groceryList.items')!)
    expect(stored.items[0]).toMatchObject({ isChecked: true, name: 'Eggs' })

    fireEvent.change(screen.getByPlaceholderText('Search items or stores'), { target: { value: 'zzz' } })
    expect(screen.getByText('No Results for “zzz”')).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('Search items or stores'), { target: { value: 'safe' } })
    expect(screen.getByText('Eggs')).toBeInTheDocument()
  })

  it('adds a new store and lists it in Store Mode, then opens its checklist', async () => {
    await freshApp()
    fireEvent.click(screen.getByRole('button', { name: 'Add Item' }))
    const sheet = screen.getByRole('dialog', { name: 'Add Item' })
    fireEvent.change(within(sheet).getByLabelText('Item name'), { target: { value: 'Salmon' } })
    fireEvent.change(within(sheet).getByLabelText('Recommended store'), { target: { value: '__new_store__' } })
    expect(within(sheet).getByText('Save')).toBeDisabled()
    fireEvent.change(within(sheet).getByLabelText('New store name'), { target: { value: 'Costco' } })
    fireEvent.click(within(sheet).getByText('Save'))

    fireEvent.click(screen.getByRole('button', { name: /Store Mode/ }))
    fireEvent.click(await screen.findByText('Costco'))
    expect(await screen.findByText('Salmon')).toBeInTheDocument()
    expect(screen.getByText('Qty: 1')).toBeInTheDocument()
  })

  it('disables Sync Now when the build has no server URL', async () => {
    await freshApp()
    fireEvent.click(screen.getByRole('button', { name: /Settings/ }))
    expect((await screen.findByText('Sync Now')).closest('button')).toBeDisabled()
    expect(screen.getByText('The Joshis')).toBeInTheDocument()
  })
})

describe('household workflows', () => {
  const session = { householdId: 'H', householdName: 'The Joshis', memberId: 'M', deviceToken: 'tok-new' }
  const stubServer = (respond: (body: { action: string }) => object) => {
    const fetchMock = vi.fn(async (_u: unknown, init?: RequestInit) => new Response(JSON.stringify(respond(JSON.parse(init!.body as string)))))
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }
  const gateApp = async () => {
    localStorage.clear()
    vi.doMock('./config', () => ({ API_URL: 'https://script.google.com/macros/s/x/exec' }))
    return freshApp()
  }
  const fill = (name: string, passcode: string) => {
    fireEvent.change(screen.getByLabelText('Household name'), { target: { value: name } })
    fireEvent.change(screen.getByLabelText('Passcode'), { target: { value: passcode } })
  }

  it('shows the join screen instead of the app until signed in', async () => {
    await gateApp()
    expect(screen.getByRole('tab', { name: 'Join household' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('button', { name: /Store Mode/ })).toBeNull()
  })

  it('enforces passcode rules when creating, then enters the app', async () => {
    const server = stubServer((b) => (b.action === 'createHousehold' ? session : { items: [] }))
    await gateApp()
    fireEvent.click(screen.getByRole('tab', { name: 'Create household' }))
    const submit = screen.getByRole('button', { name: 'Create household' })

    fill('The Joshis', 'weakpass')
    expect(submit).toBeDisabled()
    expect(screen.getByText(/A special character/).textContent).toContain('○')

    fill('The Joshis', 'Fresh&Milk42')
    fireEvent.change(screen.getByLabelText('Your name (optional)'), { target: { value: ' Alok ' } })
    expect(submit).toBeEnabled()
    fireEvent.click(submit)

    expect(await screen.findByRole('button', { name: /Store Mode/ })).toBeInTheDocument()
    expect(JSON.parse(server.mock.calls[0][1]!.body as string)).toEqual({ action: 'createHousehold', name: 'The Joshis', passcode: 'Fresh&Milk42', displayName: 'Alok' })
    expect(localStorage.getItem('syncDisplayName')).toBe('Alok')
    expect(localStorage.getItem('syncDeviceToken')).toBe('tok-new')
    expect(localStorage.getItem('syncSharedSecret')).toBeNull()
  })

  it('shows the server error when the passcode is wrong and stays on the join screen', async () => {
    stubServer(() => ({ error: 'invalid household name or passcode' }))
    await gateApp()
    fill('The Joshis', 'Wrong&Pass1')
    fireEvent.click(screen.getByRole('button', { name: 'Join household' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('invalid household name or passcode')
    expect(localStorage.getItem('syncDeviceToken')).toBeNull()
  })

  it('leaves the household, clearing the token and local items', async () => {
    stubServer(() => ({ success: true }))
    vi.doMock('./config', () => ({ API_URL: 'https://script.google.com/macros/s/x/exec' }))
    vi.stubGlobal('confirm', () => true)
    await freshApp()
    fireEvent.click(screen.getByRole('button', { name: /Settings/ }))
    fireEvent.click(await screen.findByText('Leave household'))
    expect(await screen.findByRole('tab', { name: 'Join household' })).toBeInTheDocument()
    expect(localStorage.getItem('syncDeviceToken')).toBe('')
    expect(JSON.parse(localStorage.getItem('groceryList.items')!).items).toEqual([])
  })
})
