import { ethers } from "ethers";

export const contractAddress = "0xd2a5bC10698FD955D1Fe6cb468a17809A08fd005";

export const abi = [
  {
    "inputs": [
      { "internalType": "string", "name": "_patientId", "type": "string" },
      { "internalType": "string", "name": "_recordId", "type": "string" },
      { "internalType": "string", "name": "_recordHash", "type": "string" },
      { "internalType": "string", "name": "_recordType", "type": "string" },
      { "internalType": "string", "name": "_fileName", "type": "string" }
    ],
    "name": "addRecord",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "string", "name": "_patientId", "type": "string" },
      { "internalType": "string", "name": "_recordId", "type": "string" },
      { "internalType": "string", "name": "_recordHash", "type": "string" }
    ],
    "name": "verifyRecord",
    "outputs": [
      { "internalType": "bool", "name": "isValid", "type": "bool" },
      { "internalType": "uint256", "name": "timestamp", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

export const getContract = async () => {

  if (!window.ethereum) {
    alert("Please install MetaMask");
    return null;
  }

  const provider = new ethers.BrowserProvider(window.ethereum);

  await provider.send("eth_requestAccounts", []);

  const signer = await provider.getSigner();

  return new ethers.Contract(contractAddress, abi, signer);
};