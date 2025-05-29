'use client';

import type { CartItem, Unit, GatePass } from '@/types';
import { fetchUnits } from '@/lib/unitService';
import { saveGatePassToLocalStorage } from '@/lib/localStorage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Trash2, FileText, Send } from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';

export default function OutgoingForm() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [responsibleParty, setResponsibleParty] = useState<string>('');
  const [availableUnits, setAvailableUnits] = useState<Unit[]>([]);
  const [generatedGatePassText, setGeneratedGatePassText] = useState<string>('');
  const [isLoadingUnits, setIsLoadingUnits] = useState<boolean>(true);
  const [newItemName, setNewItemName] = useState<string>('');
  const [newItemQuantity, setNewItemQuantity] = useState<number>(1);

  const { toast } = useToast();

  useEffect(() => {
    async function loadUnits() {
      setIsLoadingUnits(true);
      try {
        const units = await fetchUnits();
        setAvailableUnits(units);
      } catch (error) {
        console.error('Failed to fetch units:', error);
        toast({
          title: 'Error',
          description: 'Could not load units. Please try refreshing.',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingUnits(false);
      }
    }
    loadUnits();
  }, [toast]);

  const handleAddItemToCart = () => {
    if (!newItemName.trim() || newItemQuantity <= 0) {
      toast({
        title: 'Invalid Item',
        description: 'Please enter a valid item name and quantity.',
        variant: 'destructive',
      });
      return;
    }
    const newItem: CartItem = {
      id: Date.now().toString(), // Simple unique ID
      name: newItemName.trim(),
      quantity: newItemQuantity,
    };
    setCartItems(prevItems => [...prevItems, newItem]);
    setNewItemName('');
    setNewItemQuantity(1);
  };

  const handleRemoveItemFromCart = (itemId: string) => {
    setCartItems(prevItems => prevItems.filter(item => item.id !== itemId));
  };

  const handleUnitChange = (itemId: string, unitId: string) => {
    const unit = availableUnits.find(u => u.id === unitId);
    setCartItems(prevItems =>
      prevItems.map(item =>
        item.id === itemId ? { ...item, selectedUnitId: unitId, unitName: unit?.name || unitId } : item
      )
    );
  };

  const handleQuantityChange = (itemId: string, quantity: number) => {
    if (quantity > 0) {
      setCartItems(prevItems =>
        prevItems.map(item =>
          item.id === itemId ? { ...item, quantity } : item
        )
      );
    }
  };

  const generateGatePassText = useCallback(() => {
    if (!responsibleParty.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please enter the responsible party.',
        variant: 'destructive',
      });
      return '';
    }
    if (cartItems.length === 0) {
      toast({
        title: 'Empty Cart',
        description: 'Please add items to the cart.',
        variant: 'destructive',
      });
      return '';
    }

    let passText = `GATE PASS\n\n`;
    passText += `Date: ${new Date().toLocaleDateString()}\n`;
    passText += `Time: ${new Date().toLocaleTimeString()}\n\n`;
    passText += `Responsible Party: ${responsibleParty}\n\n`;
    passText += `Items:\n`;
    passText += `------------------------------------\n`;

    cartItems.forEach(item => {
      const unitDisplay = item.unitName || item.selectedUnitId || 'N/A';
      passText += `- ${item.name}: ${item.quantity} ${unitDisplay}\n`;
    });
    passText += `------------------------------------\n\n`;
    passText += `Approved By: ________________________\n`;
    passText += `Signature: _________________________\n`;

    return passText;
  }, [responsibleParty, cartItems, availableUnits, toast]);


  const handleGenerateAndSaveGatePass = () => {
    const passText = generateGatePassText();
    if (!passText) return;

    setGeneratedGatePassText(passText);

    const gatePassData: GatePass = {
      id: `GP-${Date.now()}`,
      responsibleParty,
      items: cartItems.map(item => ({
        ...item,
        unitName: item.unitName || availableUnits.find(u => u.id === item.selectedUnitId)?.name || item.selectedUnitId || 'N/A'
      })),
      createdAt: new Date().toISOString(),
      generatedText: passText,
    };

    saveGatePassToLocalStorage(gatePassData);
    toast({
      title: 'Gate Pass Generated',
      description: 'Gate pass has been generated and saved locally.',
    });
  };

  return (
    <div className="space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">Add Items to Gate Pass</CardTitle>
          <CardDescription>Specify items, quantities, and units for the gate pass.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-1">
              <Label htmlFor="responsibleParty">Responsible Party</Label>
              <Input
                id="responsibleParty"
                value={responsibleParty}
                onChange={e => setResponsibleParty(e.target.value)}
                placeholder="e.g., John Doe"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="md:col-span-2 space-y-1">
              <Label htmlFor="newItemName">Item Name</Label>
              <Input
                id="newItemName"
                value={newItemName}
                onChange={e => setNewItemName(e.target.value)}
                placeholder="e.g., Laptop, Cables"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="newItemQuantity">Quantity</Label>
              <Input
                id="newItemQuantity"
                type="number"
                value={newItemQuantity}
                onChange={e => setNewItemQuantity(parseInt(e.target.value, 10))}
                min="1"
              />
            </div>
            <Button onClick={handleAddItemToCart} className="w-full md:w-auto" aria-label="Add item to cart">
              <PlusCircle className="mr-2 h-5 w-5" /> Add Item
            </Button>
          </div>
        </CardContent>
      </Card>

      {cartItems.length > 0 && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Cart Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {cartItems.map(item => (
                <div key={item.id} className="flex flex-col md:flex-row items-center justify-between gap-4 p-3 border rounded-lg bg-secondary/30">
                  <div className="flex-1">
                    <p className="font-medium">{item.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                     <Label htmlFor={`quantity-${item.id}`} className="sr-only">Quantity</Label>
                     <Input
                        id={`quantity-${item.id}`}
                        type="number"
                        value={item.quantity}
                        onChange={e => handleQuantityChange(item.id, parseInt(e.target.value, 10))}
                        min="1"
                        className="w-20 h-9"
                      />
                    <Select
                      value={item.selectedUnitId}
                      onValueChange={unitId => handleUnitChange(item.id, unitId)}
                      disabled={isLoadingUnits}
                    >
                      <SelectTrigger className="w-[120px] h-9">
                        <SelectValue placeholder={isLoadingUnits ? "Loading..." : "Unit"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableUnits.map(unit => (
                          <SelectItem key={unit.id} value={unit.id}>
                            {unit.name} ({unit.abbreviation || unit.id})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveItemFromCart(item.id)}
                    aria-label={`Remove ${item.name} from cart`}
                  >
                    <Trash2 className="h-5 w-5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Generate Gate Pass</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={handleGenerateAndSaveGatePass} className="w-full" disabled={cartItems.length === 0 || !responsibleParty.trim()}>
            <FileText className="mr-2 h-5 w-5" /> Generate & Save Gate Pass
          </Button>
          {generatedGatePassText && (
            <div className="mt-6 space-y-2">
              <Label htmlFor="gatePassPreview">Gate Pass Preview</Label>
              <Textarea
                id="gatePassPreview"
                value={generatedGatePassText}
                readOnly
                rows={15}
                className="bg-muted/50 font-mono text-sm"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
