import { ethers } from "ethers";

export const contractAddress = "0xA370aC548d9C5579Ac9e5023488EA5947D11B589";

export const abi = [
  "function addRecord(string memory _patientId, string memory _hash) public"
];

export const getContract = async () => {

  if (!window.ethereum) {
    alert("Please install MetaMask");
    return null;
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();

  return new ethers.Contract(contractAddress, abi, signer);
};