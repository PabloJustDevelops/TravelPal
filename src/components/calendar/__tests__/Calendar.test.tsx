
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { Calendar } from '../Calendar';
import { format } from 'date-fns';

// Mock Heroicons to avoid rendering issues in tests
jest.mock('@heroicons/react/24/outline', () => ({
  ChevronLeftIcon: () => <div data-testid="chevron-left" />,
  ChevronRightIcon: () => <div data-testid="chevron-right" />,
  PlusIcon: () => <div data-testid="plus-icon" />,
  ClockIcon: () => <div data-testid="clock-icon" />,
  TrashIcon: () => <div data-testid="trash-icon" />,
}));

describe('Calendar Component', () => {
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  
  const mockEvents = [
    {
      id: '1',
      title: 'Test Event',
      date: todayStr,
      type: 'booking' as const,
      color: 'bg-blue-500',
      description: 'Test Description',
      icon: <div data-testid="event-icon" />
    }
  ];

  it('renders correctly', () => {
    render(<Calendar events={mockEvents} />);
    expect(screen.getByText(/Test Event/i)).toBeInTheDocument();
    expect(screen.getByTestId('event-icon')).toBeInTheDocument();
  });

  it('calls onEventClick when an event is clicked', () => {
    const handleEventClick = jest.fn();
    render(<Calendar events={mockEvents} onEventClick={handleEventClick} />);
    
    const eventElement = screen.getByText(/Test Event/i);
    fireEvent.click(eventElement);
    
    expect(handleEventClick).toHaveBeenCalledTimes(1);
    expect(handleEventClick).toHaveBeenCalledWith(mockEvents[0]);
  });

  it('shows delete option on right click', () => {
    const handleDeleteEvent = jest.fn();
    render(<Calendar events={mockEvents} onDeleteEvent={handleDeleteEvent} />);
    
    const eventElement = screen.getByText(/Test Event/i).closest('div');
    fireEvent.contextMenu(eventElement!);
    
    const deleteButton = screen.getByText('Eliminar');
    expect(deleteButton).toBeInTheDocument();
    
    fireEvent.click(deleteButton);
    expect(handleDeleteEvent).toHaveBeenCalledTimes(1);
    expect(handleDeleteEvent).toHaveBeenCalledWith(mockEvents[0]);
  });
  
  it('calls onAddEvent on double click in month view', () => {
    const handleAddEvent = jest.fn();
    render(<Calendar onAddEvent={handleAddEvent} />);
    
    // Get the cell for today
    const todayCell = screen.getByText(today.getDate().toString()).closest('div')?.parentElement;
    fireEvent.doubleClick(todayCell!);
    
    expect(handleAddEvent).toHaveBeenCalledTimes(1);
  });

  // La fecha tal cual la devuelve PostgREST para una columna `timestamptz`. Con
  // el filtro comparando la cadena entera, el viaje no se pintaba en ningun dia.
  it('pinta en su dia un evento con la fecha timestamptz de PostgREST', () => {
    // El dia 15 nunca se repite en la rejilla del mes: sirve de celda inequivoca
    // sea cual sea el mes en que corra la prueba.
    const day = new Date(today.getFullYear(), today.getMonth(), 15);
    const dayStr = format(day, 'yyyy-MM-dd');

    const events = [
      {
        id: 'trip_1',
        title: 'Viaje a Roma',
        date: `${dayStr}T00:00:00+00:00`,
        type: 'trip' as const,
        color: 'bg-blue-500',
      },
      {
        // El mismo dia, en otra hora: tiene que caer en la misma celda.
        id: 'booking_1',
        title: 'Reserva del mismo dia',
        date: `${dayStr}T18:30:00+00:00`,
        type: 'booking' as const,
        color: 'bg-green-500',
      },
      {
        id: 'activity_1',
        title: 'Actividad ya en clave de dia',
        date: dayStr,
        type: 'activity' as const,
        color: 'bg-purple-500',
      },
    ];

    render(<Calendar events={events} />);

    const dayCell = screen
      .getByText(day.getDate().toString())
      .closest('div')?.parentElement;

    expect(within(dayCell!).getByText('Viaje a Roma')).toBeInTheDocument();
    expect(within(dayCell!).getByText('Reserva del mismo dia')).toBeInTheDocument();
    expect(
      within(dayCell!).getByText('Actividad ya en clave de dia'),
    ).toBeInTheDocument();
  });
});
