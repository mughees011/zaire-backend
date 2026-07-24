import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'backend'))
from specialists.trader import TraderSpecialist
import inspect

trader = TraderSpecialist(None)
sig = inspect.signature(trader.handle)
print(f"TraderSpecialist.handle signature: {sig}")
if 'uploaded_filepaths' in sig.parameters:
    print("Found uploaded_filepaths")
else:
    print("NOT FOUND uploaded_filepaths")
