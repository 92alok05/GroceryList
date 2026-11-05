import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

async function freshApp() {
  vi.resetModules()
  const { App } = await import('./App')
  return render(<App />)
}

beforeEach(() => {
  localStorage.clear()
  window.location.hash = ''
})
afterEach(cleanup)

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

  it('disables Sync Now until configured', async () => {
    await freshApp()
    fireEvent.click(screen.getByRole('button', { name: /Settings/ }))
    expect((await screen.findByText('Sync Now')).closest('button')).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Web App URL'), { target: { value: 'https://script.google.com/x' } })
    fireEvent.change(screen.getByLabelText('Shared secret'), { target: { value: 'k' } })
    expect(screen.getByText('Sync Now').closest('button')).toBeEnabled()
  })
})
