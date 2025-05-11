'use client';

import React from 'react';

// Assuming SaleData type is defined elsewhere and imported
// For now, let's define a basic one here if not available globally
export interface SaleData {
  id: string;
  product?: string;
  amount?: number | string;
  price?: number | string;
  totalPrice?: number | string;
  paymentMethod?: string;
  client?: string;
  date?: string; // Assuming date is a string, format as needed
  // Add other fields as necessary
}

interface SalesDisplayProps {
  sales: SaleData[];
  // activeFields: string[]; // To control visible columns
  // columnOrder: string[]; // To control column order
  // onSelectSale?: (id: string) => void; // For row selection
  // selectedSales?: string[];
}

const SalesDisplay: React.FC<SalesDisplayProps> = ({ 
  sales
  // activeFields, 
  // columnOrder, 
  // onSelectSale, 
  // selectedSales 
}) => {

  // Default headers based on the second image, can be made dynamic with activeFields/columnOrder later
  const headers = [
    { key: 'product', name: 'Producto' },
    { key: 'amount', name: 'Cantidad' },
    { key: 'price', name: 'Precio' },
    { key: 'totalPrice', name: 'Total' },
    { key: 'paymentMethod', name: 'Método de pago' },
    { key: 'client', name: 'Cliente' },
    { key: 'date', name: 'Fecha' },
    // { key: 'select', name: 'Seleccionar' } // Selection can be a checkbox column
  ];

  if (!sales || sales.length === 0) {
    return (
      <div className="w-full p-6 my-4 bg-white dark:bg-gray-800 shadow-md rounded-lg text-center">
        <p className="text-gray-500 dark:text-gray-400">No hay ventas registradas</p>
      </div>
    );
  }

  return (
    <div className="w-full my-4 overflow-x-auto bg-white dark:bg-gray-800 shadow-lg rounded-lg">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            {/* Optional: Checkbox for select all */}
            {/* <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"> 
              <input type="checkbox" />
            </th> */}
            {headers.map(header => (
              <th 
                key={header.key} 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
              >
                {header.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {sales.map((sale) => (
            <tr key={sale.id} className="hover:bg-gray-100 dark:hover:bg-gray-700">
              {/* Optional: Checkbox for row selection */}
              {/* <td className="px-6 py-4 whitespace-nowrap">
                <input 
                  type="checkbox" 
                  // checked={selectedSales?.includes(sale.id)}
                  // onChange={() => onSelectSale && onSelectSale(sale.id)}
                />
              </td> */}
              {headers.map(header => (
                <td key={header.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-200">
                  {sale[header.key as keyof SaleData] !== undefined && sale[header.key as keyof SaleData] !== null 
                    ? String(sale[header.key as keyof SaleData]) 
                    : '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SalesDisplay; 