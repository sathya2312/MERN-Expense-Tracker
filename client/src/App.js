import './App.css';
import Graph from './components/Graph';
import Form from './components/Form';
import Budget from './components/Budget';
import BudgetUtilization from './components/BudgetUtilization';

function App() {
  return (
    <div className='App'>
      <div className='container mx-auto max-w-6xl text-center drop-shadow-lg text-gray-800'>
        <h1 className='text-4xl py-8 mb-10 bg-purple text-white rounded'>Expense Tracker</h1>
        <div className='grid md:grid-cols-2 gap-4'>
          <Graph></Graph>
          <Form></Form>
        </div>
        <hr className='my-10 border-gray-200' />
        <h2 className='text-2xl py-4 mb-6 bg-purple text-white rounded'>Budget Management</h2>
        <div className='grid md:grid-cols-2 gap-4'>
          <Budget></Budget>
          <BudgetUtilization></BudgetUtilization>
        </div>
      </div>
    </div>
  );
}

export default App;
